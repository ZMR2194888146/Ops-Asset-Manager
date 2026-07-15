mod ssh;
mod minio;

use serde::{Deserialize, Serialize};
use ssh::{FileEntry, SessionManager, SshConfig};
use std::sync::Arc;
use tauri::State;
use tauri_plugin_dialog::DialogExt;
use tokio::sync::Mutex;

struct AppState {
    sessions: Arc<Mutex<SessionManager>>,
}

#[tauri::command]
async fn ssh_connect(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    config: SshConfig,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    sessions.connect(app, session_id, config).await
}

#[tauri::command]
async fn ssh_test(config: SshConfig) -> Result<String, String> {
    SessionManager::test_connection(config).await
}

#[tauri::command]
async fn ssh_write(
    state: State<'_, AppState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    sessions.write(&session_id, &data).await
}

#[tauri::command]
async fn ssh_resize(
    state: State<'_, AppState>,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    sessions.resize(&session_id, cols, rows).await
}

#[tauri::command]
async fn ssh_disconnect(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    sessions.disconnect(&session_id).await
}

// --- Port Forward ---

#[tauri::command]
async fn start_port_forward(
    state: State<'_, AppState>,
    session_id: String,
    forward_id: String,
    local_host: String,
    local_port: u16,
    remote_host: String,
    remote_port: u16,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    sessions
        .start_forward(&session_id, forward_id, local_host, local_port, remote_host, remote_port)
        .await
}

#[tauri::command]
async fn stop_port_forward(
    state: State<'_, AppState>,
    session_id: String,
    forward_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    sessions.stop_forward(&session_id, &forward_id).await
}

#[derive(Debug, Serialize)]
struct ServerStats {
    cpu_usage: f64,
    cpu_cores: u32,
    mem_total: u64,
    mem_used: u64,
    mem_free: u64,
    swap_total: u64,
    swap_used: u64,
    disk_total: u64,
    disk_used: u64,
    disk_free: u64,
    net_rx_bytes: u64,
    net_tx_bytes: u64,
    uptime_seconds: u64,
    load_avg_1: f64,
    load_avg_5: f64,
    load_avg_15: f64,
    processes: u32,
    hostname: String,
    os_info: String,
    kernel: String,
}

#[tauri::command]
async fn server_stats(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<ServerStats, String> {
    let mut sessions = state.sessions.lock().await;
    let raw = sessions.exec(&session_id, "cat /proc/stat /proc/meminfo /proc/net/dev /proc/loadavg /proc/uptime 2>/dev/null; echo '---HOSTNAME---'; hostname; echo '---KERNEL---'; uname -r; echo '---OS---'; cat /etc/os-release 2>/dev/null | head -1; echo '---DISK---'; df -B1 / 2>/dev/null | tail -1; echo '---PROCS---'; ls /proc 2>/dev/null | grep -c '^[0-9]'; echo '---CORES---'; nproc 2>/dev/null").await?;
    drop(sessions);

    let mut cpu_usage = 0.0;
    let mut cpu_cores = 1u32;
    let mut mem_total = 0u64;
    let mut mem_free = 0u64;
    let mut mem_available = 0u64;
    let mut swap_total = 0u64;
    let mut swap_free = 0u64;
    let mut net_rx: u64 = 0;
    let mut net_tx: u64 = 0;
    let mut load1 = 0.0;
    let mut load5 = 0.0;
    let mut load15 = 0.0;
    let mut uptime = 0u64;
    let mut hostname = String::new();
    let mut kernel = String::new();
    let mut os_info = String::new();
    let mut disk_total = 0u64;
    let mut disk_used = 0u64;
    let mut disk_free = 0u64;
    let mut processes = 0u32;

    for line in raw.lines() {
        let line = line.trim();
        if line.starts_with("cpu ") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 5 {
                let user: f64 = parts[1].parse().unwrap_or(0.0);
                let nice: f64 = parts[2].parse().unwrap_or(0.0);
                let system: f64 = parts[3].parse().unwrap_or(0.0);
                let idle: f64 = parts[4].parse().unwrap_or(0.0);
                let total = user + nice + system + idle;
                if total > 0.0 {
                    cpu_usage = (1.0 - idle / total) * 100.0;
                }
            }
        } else if line.starts_with("MemTotal:") {
            mem_total = line.split_whitespace().nth(1).unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("MemAvailable:") {
            mem_available = line.split_whitespace().nth(1).unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("MemFree:") {
            mem_free = line.split_whitespace().nth(1).unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("SwapTotal:") {
            swap_total = line.split_whitespace().nth(1).unwrap_or("0").parse().unwrap_or(0);
        } else if line.starts_with("SwapFree:") {
            swap_free = line.split_whitespace().nth(1).unwrap_or("0").parse().unwrap_or(0);
        } else if line.contains(":") && (line.contains("eth0") || line.contains("ens") || line.contains("enp") || line.contains("wlan")) {
            // net/dev line: interface: rx_bytes ... tx_bytes
            if let Some(colon_pos) = line.find(':') {
                let nums: Vec<&str> = line[colon_pos + 1..].split_whitespace().collect();
                if nums.len() >= 9 {
                    net_rx += nums[0].parse::<u64>().unwrap_or(0);
                    net_tx += nums[8].parse::<u64>().unwrap_or(0);
                }
            }
        } else if line.starts_with(|c: char| c.is_ascii_digit()) && line.contains(' ') && line.split_whitespace().count() == 3 {
            // loadavg: "0.12 0.15 0.10 1/234 5678"
            // This might be loadavg line — but it has spaces not just 3 numbers
            // Actually loadavg format: "0.00 0.01 0.05 1/123 45678"
            // Skip — handled below
        }
        // loadavg
        if line.split_whitespace().count() >= 3 && line.split_whitespace().all(|p| p.parse::<f64>().is_ok() || p.contains('/')) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                load1 = parts[0].parse().unwrap_or(0.0);
                load5 = parts[1].parse().unwrap_or(0.0);
                load15 = parts[2].parse().unwrap_or(0.0);
            }
        }
        // uptime first number
        if line.split_whitespace().count() == 2 && line.split_whitespace().all(|p| p.parse::<f64>().is_ok()) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            uptime = parts[0].parse::<f64>().unwrap_or(0.0) as u64;
        }
        if line == "---HOSTNAME---" { /* next line is hostname */ }
        if line == "---KERNEL---" { /* next line is kernel */ }
        if line == "---OS---" { /* next line is os */ }
        if line == "---DISK---" { /* next line is disk */ }
        if line == "---PROCS---" { /* next line is procs */ }
        if line == "---CORES---" { /* next line is cores */ }
    }

    // Parse sections after markers
    let sections: Vec<&str> = raw.split("---HOSTNAME---").collect();
    if sections.len() > 1 {
        let after = sections[1];
        let mut iter = after.lines().map(|l| l.trim()).filter(|l| !l.is_empty());
        hostname = iter.next().unwrap_or("").to_string();

        // After hostname, find kernel
        for line in after.lines() {
            let line = line.trim();
            if line == "---KERNEL---" {
                kernel = after.lines()
                    .skip_while(|l| l.trim() != "---KERNEL---")
                    .nth(1)
                    .unwrap_or("")
                    .trim()
                    .to_string();
            }
            if line == "---OS---" {
                os_info = after.lines()
                    .skip_while(|l| l.trim() != "---OS---")
                    .nth(1)
                    .unwrap_or("")
                    .trim()
                    .trim_start_matches("PRETTY_NAME=\"")
                    .trim_end_matches("\"")
                    .to_string();
            }
            if line == "---DISK---" {
                let disk_line = after.lines()
                    .skip_while(|l| l.trim() != "---DISK---")
                    .nth(1)
                    .unwrap_or("");
                let parts: Vec<&str> = disk_line.split_whitespace().collect();
                if parts.len() >= 4 {
                    disk_total = parts[1].parse().unwrap_or(0);
                    disk_used = parts[2].parse().unwrap_or(0);
                    disk_free = parts[3].parse().unwrap_or(0);
                }
            }
            if line == "---PROCS---" {
                let proc_line = after.lines()
                    .skip_while(|l| l.trim() != "---PROCS---")
                    .nth(1)
                    .unwrap_or("0");
                processes = proc_line.trim().parse().unwrap_or(0);
            }
            if line == "---CORES---" {
                let core_line = after.lines()
                    .skip_while(|l| l.trim() != "---CORES---")
                    .nth(1)
                    .unwrap_or("1");
                cpu_cores = core_line.trim().parse().unwrap_or(1);
            }
        }
    }

    let mem_used = mem_total.saturating_sub(mem_available);
    let swap_used = swap_total.saturating_sub(swap_free);

    Ok(ServerStats {
        cpu_usage: (cpu_usage * 100.0).round() / 100.0,
        cpu_cores,
        mem_total, mem_used, mem_free,
        swap_total, swap_used,
        disk_total, disk_used, disk_free,
        net_rx_bytes: net_rx, net_tx_bytes: net_tx,
        uptime_seconds: uptime,
        load_avg_1: load1, load_avg_5: load5, load_avg_15: load15,
        processes,
        hostname, os_info, kernel,
    })
}

// --- SFTP ---

#[tauri::command]
async fn sftp_init(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    sessions.sftp_init(&session_id).await
}

#[tauri::command]
async fn sftp_list(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<Vec<FileEntry>, String> {
    let mut sessions = state.sessions.lock().await;
    sessions.sftp_list(&session_id, &path).await
}

#[tauri::command]
async fn sftp_read_file(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<Vec<u8>, String> {
    let mut sessions = state.sessions.lock().await;
    sessions.sftp_read_file(&session_id, &path).await
}

#[tauri::command]
async fn sftp_write_file(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    sessions.sftp_write_file(&session_id, &path, data).await
}

#[tauri::command]
async fn sftp_mkdir(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    sessions.sftp_mkdir(&session_id, &path).await
}

#[tauri::command]
async fn sftp_remove(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    is_dir: bool,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    sessions.sftp_remove(&session_id, &path, is_dir).await
}

#[tauri::command]
async fn sftp_rename(
    state: State<'_, AppState>,
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    sessions.sftp_rename(&session_id, &old_path, &new_path).await
}

#[tauri::command]
async fn sftp_realpath(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<String, String> {
    let mut sessions = state.sessions.lock().await;
    sessions.sftp_realpath(&session_id, &path).await
}

// --- Config File ---

fn rsm_dir() -> Result<std::path::PathBuf, String> {
    let home = dirs_or_home()?;
    let dir = std::path::Path::new(&home).join(".new-rsm");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {}", e))?;
    Ok(dir)
}

fn meta_path() -> Result<std::path::PathBuf, String> {
    Ok(rsm_dir()?.join("meta.json"))
}

#[tauri::command]
async fn get_config_path() -> Result<String, String> {
    // 1. Try meta.json — stores the user's chosen config file path
    if let Ok(content) = std::fs::read_to_string(meta_path()?) {
        if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(path) = meta.get("configFilePath").and_then(|v| v.as_str()) {
                if !path.is_empty() {
                    return Ok(path.to_string());
                }
            }
        }
    }
    // 2. Fall back to default
    Ok(rsm_dir()?.join("config.json").to_string_lossy().to_string())
}

#[tauri::command]
async fn set_config_path(path: String) -> Result<(), String> {
    let meta = serde_json::json!({ "configFilePath": path });
    std::fs::write(meta_path()?, serde_json::to_string_pretty(&meta).unwrap())
        .map_err(|e| format!("Failed to write meta: {}", e))
}

fn dirs_or_home() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Cannot determine home directory".to_string())
}

#[tauri::command]
async fn read_config_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read config file: {}", e))
}

#[tauri::command]
async fn write_config_file(path: String, data: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    std::fs::write(&path, data).map_err(|e| format!("Failed to write config file: {}", e))
}

// --- Config Export ---

#[tauri::command]
async fn export_config(
    app: tauri::AppHandle,
    data: String,
    format: String,
) -> Result<String, String> {
    let file_name = if format == "ssh" { "ssh_config" } else { "rsm_config" };
    let extension = if format == "ssh" { "config" } else { "json" };

    let file_path = app
        .dialog()
        .file()
        .set_file_name(file_name)
        .add_filter("Config", &[extension])
        .blocking_save_file();

    if let Some(path) = file_path {
        let path = path.into_path().unwrap();
        std::fs::write(&path, data).map_err(|e| e.to_string())?;
        return Ok(path.to_string_lossy().to_string());
    }

    Err("Export cancelled".to_string())
}

// --- AI Completion ---

#[derive(Debug, Deserialize)]
struct AiRequest {
    provider: String,
    api_key: String,
    base_url: String,
    model: String,
    prompt: String,
}

const SYSTEM_PROMPT: &str = "You are a Linux command-line expert. The user describes what they want to do. Respond with ONLY the shell command(s), no explanation, no markdown fences. If the request is ambiguous, make a reasonable assumption.";

#[tauri::command]
async fn ai_complete(req: AiRequest) -> Result<String, String> {
    if req.api_key.is_empty() && req.provider != "ollama" {
        return Err("No API key configured. Set it in Settings > AI Configuration.".into());
    }

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let base = req.base_url.trim_end_matches('/');
    let url = if req.provider == "anthropic" {
        // Anthropic: {base}/v1/messages — ensure no double /v1
        if base.ends_with("/v1") {
            format!("{}/messages", base)
        } else {
            format!("{}/v1/messages", base)
        }
    } else {
        // OpenAI-compatible (openai, ollama, custom): {base}/v1/chat/completions
        if base.ends_with("/v1") {
            format!("{}/chat/completions", base)
        } else {
            format!("{}/v1/chat/completions", base)
        }
    };

    let body = if req.provider == "anthropic" {
        serde_json::json!({
            "model": req.model,
            "max_tokens": 256,
            "system": SYSTEM_PROMPT,
            "messages": [{ "role": "user", "content": req.prompt }]
        })
    } else {
        serde_json::json!({
            "model": req.model,
            "messages": [
                { "role": "system", "content": SYSTEM_PROMPT },
                { "role": "user", "content": req.prompt }
            ],
            "temperature": 0.3,
            "max_tokens": 256
        })
    };

    let mut request_builder = client.post(&url).json(&body);

    if req.provider == "anthropic" {
        request_builder = request_builder
            .header("x-api-key", &req.api_key)
            .header("anthropic-version", "2023-06-01");
    } else if !req.api_key.is_empty() {
        request_builder = request_builder.bearer_auth(&req.api_key);
    }

    let resp = request_builder
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Read body: {}", e))?;

    if !status.is_success() {
        return Err(format!("AI API error ({}): {}", status, truncate_str(&text, 200)));
    }

    // Parse response based on provider
    let val: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Parse response: {} — raw: {}", e, truncate_str(&text, 200)))?;

    let command = if req.provider == "anthropic" {
        val["content"][0]["text"]
            .as_str()
            .unwrap_or("")
            .trim()
            .to_string()
    } else {
        val["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .trim()
            .to_string()
    };

    if command.is_empty() {
        return Err("AI returned empty response".into());
    }

    // Strip markdown code fences if present
    let cleaned = command
        .trim_start_matches("```bash")
        .trim_start_matches("```sh")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string();

    Ok(cleaned)
}

fn truncate_str(s: &str, max: usize) -> String {
    if s.len() > max {
        format!("{}...", &s[..max])
    } else {
        s.to_string()
    }
}

pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            sessions: Arc::new(Mutex::new(SessionManager::new())),
        })
        .invoke_handler(tauri::generate_handler![
            ssh_connect,
            ssh_test,
            ssh_write,
            ssh_resize,
            ssh_disconnect,
            start_port_forward,
            stop_port_forward,
            server_stats,
            sftp_init,
            sftp_list,
            sftp_read_file,
            sftp_write_file,
            sftp_mkdir,
            sftp_remove,
            sftp_rename,
            sftp_realpath,
            read_config_file,
            write_config_file,
            get_config_path,
            set_config_path,
            export_config,
            minio::minio_list_buckets,
            minio::minio_list_objects,
            minio::minio_create_bucket,
            minio::minio_delete_bucket,
            minio::minio_upload_object,
            minio::minio_download_object,
            minio::minio_delete_object,
            ai_complete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
