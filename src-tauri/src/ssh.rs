use russh::{
    client,
    keys::load_secret_key,
    Channel, ChannelId, ChannelMsg, CryptoVec, Disconnect,
};
use russh_sftp::client::SftpSession;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

/// Shared map for reverse forwards: (remote_host, remote_port) -> (local_host, local_port)
type ReverseForwards = Arc<std::sync::Mutex<HashMap<(String, u32), (String, u16)>>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub password: Option<String>,
    pub private_key_path: Option<String>,
    pub private_key_passphrase: Option<String>,
}

struct Client {
    reverse_forwards: ReverseForwards,
}

#[async_trait::async_trait]
impl client::Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::key::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }

    async fn server_channel_open_forwarded_tcpip(
        &mut self,
        channel: Channel<client::Msg>,
        connected_address: &str,
        connected_port: u32,
        _originator_address: &str,
        _originator_port: u32,
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        // Look up the local target for this reverse forward
        let target = {
            let map = self.reverse_forwards.lock().unwrap();
            map.get(&(connected_address.to_string(), connected_port)).cloned()
        };
        if let Some((local_host, local_port)) = target {
            tokio::spawn(async move {
                match tokio::net::TcpStream::connect(format!("{}:{}", local_host, local_port)).await {
                    Ok(mut local_stream) => {
                        let mut ssh_stream = channel.into_stream();
                        let _ = tokio::io::copy_bidirectional(&mut local_stream, &mut ssh_stream).await;
                    }
                    Err(e) => {
                        log::error!("Failed to connect to local service for reverse forward: {}", e);
                    }
                }
            });
        }
        Ok(())
    }
}

pub struct SshSession {
    handle: Arc<tokio::sync::Mutex<client::Handle<Client>>>,
    channel_id: ChannelId,
    resize_tx: mpsc::Sender<(u32, u32)>,
    forward_stops: HashMap<String, Arc<tokio::sync::Notify>>,
    reverse_forwards: ReverseForwards,
    sftp: Option<Arc<SftpSession>>,
}

pub struct SessionManager {
    sessions: HashMap<String, SshSession>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    /// Test SSH connection: connect + authenticate, then disconnect immediately.
    pub async fn test_connection(config: SshConfig) -> Result<String, String> {
        let addr = format!("{}:{}", config.host, config.port);

        let ssh_config = Arc::new(client::Config::default());
        let mut handle = client::connect(ssh_config, &addr, Client { reverse_forwards: Arc::new(std::sync::Mutex::new(HashMap::new())) })
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        let auth_ok = match config.auth_method.as_str() {
            "password" => {
                let password = config.password.as_ref().ok_or("Password not provided")?;
                handle
                    .authenticate_password(&config.username, password)
                    .await
                    .map_err(|e| format!("Auth failed: {}", e))?
            }
            "key" => {
                let key_path = config.private_key_path.as_ref().ok_or("Private key path not provided")?;
                let key = load_secret_key(key_path, config.private_key_passphrase.as_deref())
                    .map_err(|e| format!("Failed to load key: {}", e))?;
                handle
                    .authenticate_publickey(&config.username, Arc::new(key))
                    .await
                    .map_err(|e| format!("Auth failed: {}", e))?
            }
            _ => return Err(format!("Unknown auth method: {}", config.auth_method)),
        };

        if !auth_ok {
            return Err("Authentication failed".to_string());
        }

        let _ = handle.disconnect(Disconnect::ByApplication, "", "en").await;
        Ok(format!("Connected to {}@{}:{}", config.username, config.host, config.port))
    }

    pub async fn connect(
        &mut self,
        app: AppHandle,
        session_id: String,
        config: SshConfig,
    ) -> Result<(), String> {
        let addr = format!("{}:{}", config.host, config.port);

        let mut ssh_config = client::Config::default();
        ssh_config.inactivity_timeout = Some(std::time::Duration::from_secs(300));
        let ssh_config = Arc::new(ssh_config);

        let reverse_forwards: ReverseForwards = Arc::new(std::sync::Mutex::new(HashMap::new()));
        let mut handle = client::connect(ssh_config, &addr, Client { reverse_forwards: reverse_forwards.clone() })
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        let auth_ok = match config.auth_method.as_str() {
            "password" => {
                let password = config.password.as_ref().ok_or("Password not provided")?;
                handle
                    .authenticate_password(&config.username, password)
                    .await
                    .map_err(|e| format!("Auth failed: {}", e))?
            }
            "key" => {
                let key_path = config.private_key_path.as_ref().ok_or("Private key path not provided")?;
                let key = load_secret_key(key_path, config.private_key_passphrase.as_deref())
                    .map_err(|e| format!("Failed to load key: {}", e))?;
                handle
                    .authenticate_publickey(&config.username, Arc::new(key))
                    .await
                    .map_err(|e| format!("Auth failed: {}", e))?
            }
            _ => return Err(format!("Unknown auth method: {}", config.auth_method)),
        };

        if !auth_ok {
            return Err("Authentication failed".to_string());
        }

        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open channel: {}", e))?;

        channel
            .request_pty(false, "xterm-256color", 80, 24, 0, 0, &[])
            .await
            .map_err(|e| format!("Failed to request PTY: {}", e))?;

        channel
            .request_shell(false)
            .await
            .map_err(|e| format!("Failed to request shell: {}", e))?;

        let channel_id = channel.id();
        let (resize_tx, mut resize_rx) = mpsc::channel::<(u32, u32)>(16);
        let sid = session_id.clone();
        let app_clone = app.clone();

        tokio::spawn(async move {
            let mut chan = channel;
            loop {
                tokio::select! {
                    msg = chan.wait() => {
                        match msg {
                            Some(ChannelMsg::Data { ref data }) => {
                                let text = String::from_utf8_lossy(data).to_string();
                                let _ = app_clone.emit(&format!("ssh:data:{}", sid), text);
                            }
                            Some(ChannelMsg::ExtendedData { ref data, .. }) => {
                                let text = String::from_utf8_lossy(data).to_string();
                                let _ = app_clone.emit(&format!("ssh:data:{}", sid), text);
                            }
                            Some(ChannelMsg::Eof) | None => {
                                let _ = app_clone.emit(&format!("ssh:closed:{}", sid), ());
                                break;
                            }
                            _ => {}
                        }
                    }
                    resize = resize_rx.recv() => {
                        if let Some((cols, rows)) = resize {
                            let _ = chan.window_change(cols, rows, 0, 0).await;
                        }
                    }
                }
            }
        });

        self.sessions.insert(
            session_id.clone(),
            SshSession {
                handle: Arc::new(tokio::sync::Mutex::new(handle)),
                channel_id,
                resize_tx,
                forward_stops: HashMap::new(),
                reverse_forwards,
                sftp: None,
            },
        );

        Ok(())
    }

    pub async fn write(&mut self, session_id: &str, data: &str) -> Result<(), String> {
        let session = self.sessions.get(session_id).ok_or("Session not found")?;
        let crypto_data = CryptoVec::from(data.as_bytes().to_vec());
        session
            .handle
            .lock()
            .await
            .data(session.channel_id, crypto_data)
            .await
            .map_err(|e| format!("Failed to write data: {:?}", e))?;
        Ok(())
    }

    pub async fn resize(&mut self, session_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let session = self.sessions.get(session_id).ok_or("Session not found")?;
        session
            .resize_tx
            .send((cols, rows))
            .await
            .map_err(|e| format!("Failed to send resize: {}", e))?;
        Ok(())
    }

    pub async fn start_forward(
        &mut self,
        session_id: &str,
        forward_id: String,
        local_host: String,
        local_port: u16,
        remote_host: String,
        remote_port: u16,
    ) -> Result<(), String> {
        let session = self.sessions.get_mut(session_id).ok_or("Session not found")?;

        // Register a stop notify for this forward
        let stop = Arc::new(tokio::sync::Notify::new());
        session.forward_stops.insert(forward_id.clone(), stop.clone());

        let handle = session.handle.clone();
        let stop_notify = stop;
        let rh = remote_host.clone();
        let rp = remote_port;
        let lh = local_host.clone();
        let lp = local_port;
        let fid = forward_id.clone();

        tokio::spawn(async move {
            let bind_addr = format!("{}:{}", lh, lp);
            let listener = match tokio::net::TcpListener::bind(&bind_addr).await {
                Ok(l) => l,
                Err(e) => {
                    log::error!("Failed to bind {}: {}", bind_addr, e);
                    return;
                }
            };

            loop {
                tokio::select! {
                    accept = listener.accept() => {
                        match accept {
                            Ok((mut local_stream, _)) => {
                                let handle_clone = handle.clone();
                                let rh_clone = rh.clone();
                                let rp_clone = rp;

                                tokio::spawn(async move {
                                    let channel_result = {
                                        let h = handle_clone.lock().await;
                                        h.channel_open_direct_tcpip(&rh_clone, rp_clone as u32, "127.0.0.1", 0).await
                                    };
                                    match channel_result {
                                        Ok(channel) => {
                                            let mut stream = channel.into_stream();
                                            let _ = tokio::io::copy_bidirectional(&mut local_stream, &mut stream).await;
                                        }
                                        Err(e) => {
                                            log::error!("Failed to open forwarded channel: {}", e);
                                        }
                                    }
                                });
                            }
                            Err(_) => break,
                        }
                    }
                    _ = stop_notify.notified() => {
                        log::info!("Forward {} stopped", fid);
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    /// Start a reverse (remote) port forward: remote_port → local_host:local_port
    pub async fn start_reverse_forward(
        &mut self,
        session_id: &str,
        forward_id: String,
        local_host: String,
        local_port: u16,
        remote_host: String,
        remote_port: u16,
    ) -> Result<(), String> {
        let session = self.sessions.get_mut(session_id).ok_or("Session not found")?;

        // Register the reverse mapping so the handler knows where to connect locally
        session.reverse_forwards.lock().unwrap()
            .insert((remote_host.clone(), remote_port as u32), (local_host.clone(), local_port));

        // Register a stop notify
        let stop = Arc::new(tokio::sync::Notify::new());
        session.forward_stops.insert(forward_id.clone(), stop.clone());

        let handle = session.handle.clone();
        let rh = remote_host.clone();
        let rp = remote_port;
        let fid = forward_id.clone();
        let reverse_map = session.reverse_forwards.clone();

        tokio::spawn(async move {
            // Request the SSH server to listen on the remote port
            let forward_result = {
                let mut h = handle.lock().await;
                h.tcpip_forward(&rh, rp as u32).await
            };

            match forward_result {
                Ok(_) => {
                    log::info!("Reverse forward {} started: {}:{} → local", fid, rh, rp);
                    // Wait for stop signal
                    stop.notified().await;
                    // Cancel the forward on the server
                    let h = handle.lock().await;
                    let _ = h.cancel_tcpip_forward(&rh, rp as u32).await;
                }
                Err(e) => {
                    log::error!("Failed to start reverse forward {}: {}", fid, e);
                }
            }
            // Clean up the mapping
            reverse_map.lock().unwrap().remove(&(rh, rp as u32));
            log::info!("Reverse forward {} stopped", fid);
        });

        Ok(())
    }

    pub async fn stop_forward(&mut self, session_id: &str, forward_id: &str) -> Result<(), String> {
        let session = self.sessions.get_mut(session_id).ok_or("Session not found")?;
        if let Some(stop) = session.forward_stops.remove(forward_id) {
            stop.notify_waiters();
        }
        Ok(())
    }

    /// Run a one-shot command on the existing SSH session and return stdout.
    /// Only holds the handle lock briefly to open the channel, so it does NOT
    /// block interactive terminal writes while waiting for command output.
    pub async fn exec(&mut self, session_id: &str, command: &str) -> Result<String, String> {
        let session = self.sessions.get_mut(session_id).ok_or("Session not found")?;
        // Open channel with a short-lived lock, then release before exec/wait
        let mut channel = {
            let h = session.handle.lock().await;
            h.channel_open_session()
                .await
                .map_err(|e| format!("Failed to open exec channel: {}", e))?
        };
        channel
            .exec(true, command)
            .await
            .map_err(|e| format!("Failed to exec: {}", e))?;

        let mut output = Vec::new();
        loop {
            match channel.wait().await {
                Some(ChannelMsg::Data { ref data }) => {
                    output.extend_from_slice(data);
                }
                Some(ChannelMsg::ExtendedData { ref data, .. }) => {
                    output.extend_from_slice(data);
                }
                Some(ChannelMsg::ExitStatus { .. }) | None => break,
                _ => {}
            }
        }
        Ok(String::from_utf8_lossy(&output).to_string())
    }

    // --- SFTP methods ---

    pub async fn sftp_init(&mut self, session_id: &str) -> Result<(), String> {
        let session = self.sessions.get_mut(session_id).ok_or("Session not found")?;
        if session.sftp.is_some() {
            return Ok(());
        }
        let channel = session
            .handle
            .lock()
            .await
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open SFTP channel: {}", e))?;
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| format!("Failed to request SFTP subsystem: {}", e))?;
        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| format!("SFTP init failed: {}", e))?;
        session.sftp = Some(Arc::new(sftp));
        Ok(())
    }

    pub async fn sftp_list(
        &mut self,
        session_id: &str,
        path: &str,
    ) -> Result<Vec<FileEntry>, String> {
        let session = self.sessions.get_mut(session_id).ok_or("Session not found")?;
        let sftp = session
            .sftp
            .as_ref()
            .ok_or("SFTP not initialized. Call sftp_init first.")?;
        let mut read_dir = sftp
            .read_dir(path)
            .await
            .map_err(|e| format!("read_dir failed: {}", e))?;
        let mut entries = Vec::new();
        for entry in read_dir.by_ref() {
            let name = entry.file_name();
            let metadata = entry.metadata();
            let file_type = entry.file_type();
            entries.push(FileEntry {
                name,
                path: entry.path(),
                is_dir: file_type.is_dir(),
                is_symlink: file_type.is_symlink(),
                size: metadata.size.unwrap_or(0),
                modified: metadata.mtime.map(|t| t as i64),
                permissions: metadata.permissions,
            });
        }
        entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
        Ok(entries)
    }

    pub async fn sftp_read_file(
        &mut self,
        session_id: &str,
        path: &str,
    ) -> Result<Vec<u8>, String> {
        let session = self.sessions.get_mut(session_id).ok_or("Session not found")?;
        let sftp = session
            .sftp
            .as_ref()
            .ok_or("SFTP not initialized")?;
        sftp.read(path).await.map_err(|e| format!("read failed: {}", e))
    }

    pub async fn sftp_write_file(
        &mut self,
        session_id: &str,
        path: &str,
        data: Vec<u8>,
    ) -> Result<(), String> {
        let session = self.sessions.get_mut(session_id).ok_or("Session not found")?;
        let sftp = session
            .sftp
            .as_ref()
            .ok_or("SFTP not initialized")?;
        sftp.write(path, &data)
            .await
            .map_err(|e| format!("write failed: {}", e))
    }

    pub async fn sftp_mkdir(
        &mut self,
        session_id: &str,
        path: &str,
    ) -> Result<(), String> {
        let session = self.sessions.get_mut(session_id).ok_or("Session not found")?;
        let sftp = session.sftp.as_ref().ok_or("SFTP not initialized")?;
        sftp.create_dir(path)
            .await
            .map_err(|e| format!("mkdir failed: {}", e))
    }

    pub async fn sftp_remove(
        &mut self,
        session_id: &str,
        path: &str,
        is_dir: bool,
    ) -> Result<(), String> {
        let session = self.sessions.get_mut(session_id).ok_or("Session not found")?;
        let sftp = session.sftp.as_ref().ok_or("SFTP not initialized")?;
        if is_dir {
            sftp.remove_dir(path)
                .await
                .map_err(|e| format!("rmdir failed: {}", e))
        } else {
            sftp.remove_file(path)
                .await
                .map_err(|e| format!("rmfile failed: {}", e))
        }
    }

    pub async fn sftp_rename(
        &mut self,
        session_id: &str,
        old_path: &str,
        new_path: &str,
    ) -> Result<(), String> {
        let session = self.sessions.get_mut(session_id).ok_or("Session not found")?;
        let sftp = session.sftp.as_ref().ok_or("SFTP not initialized")?;
        sftp.rename(old_path, new_path)
            .await
            .map_err(|e| format!("rename failed: {}", e))
    }

    pub async fn sftp_realpath(
        &mut self,
        session_id: &str,
        path: &str,
    ) -> Result<String, String> {
        let session = self.sessions.get_mut(session_id).ok_or("Session not found")?;
        let sftp = session.sftp.as_ref().ok_or("SFTP not initialized")?;
        sftp.canonicalize(path)
            .await
            .map_err(|e| format!("realpath failed: {}", e))
    }

    pub async fn disconnect(&mut self, session_id: &str) -> Result<(), String> {
        if let Some(session) = self.sessions.remove(session_id) {
            // Stop all forwards on this session
            for (_, stop) in &session.forward_stops {
                stop.notify_waiters();
            }
            let _ = session.handle.lock().await.disconnect(Disconnect::ByApplication, "", "en").await;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified: Option<i64>,
    pub permissions: Option<u32>,
}
