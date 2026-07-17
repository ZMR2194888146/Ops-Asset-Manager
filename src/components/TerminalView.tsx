import { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Stack,
  TextField,
  Button,
  Chip,
  Tooltip,
} from "@mui/material";
import {
  CloseRounded,
  TerminalRounded,
  AltRouteRounded,
  AddRounded,
  StopRounded,
  PlayArrowRounded,
  ArrowForwardRounded,
  FolderRounded,
  MonitorHeartRounded,
  KeyboardCommandKeyRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
  AutoAwesomeRounded,
} from "@mui/icons-material";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useStore } from "../stores/store";
import { ServerStatsPanel } from "./ServerStatsPanel";
import { ChatAgent } from "./ChatAgent";
import { FileManager } from "./FileManager";
import { CommandPalette } from "./CommandPalette";
import { generateId } from "../utils/id";
import { registerTerminal, unregisterTerminal, updateActualSessionId, getActualSessionId, setRemoteCwd } from "../utils/terminalRegistry";
import { getThemePreset } from "../theme/presets";
import type { ThemePreset } from "../theme/presets";
import type { ServerAsset, TerminalSession, PortForward } from "../types";
import "@xterm/xterm/css/xterm.css";

export function TerminalView() {
  const sessions = useStore((s) => s.sessions);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const setActiveSession = useStore((s) => s.setActiveSession);
  const closeSession = useStore((s) => s.closeSession);
  const setSessionStatus = useStore((s) => s.setSessionStatus);
  const getServerById = useStore((s) => s.getServerById);
  const fontSize = useStore((s) => s.settings.fontSize);
  const scrollback = useStore((s) => s.settings.scrollback);
  const themeId = useStore((s) => s.settings.themeId);
  const updateSettings = useStore((s) => s.updateSettings);
  const preset = getThemePreset(themeId);
  const termTheme = preset.terminal;

  const [showFiles, setShowFiles] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Warp-style global shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+Shift+P / Cmd+Shift+P: Command Palette
      if (mod && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }

      // Ctrl+] / Cmd+]: Next session tab
      if (mod && e.key === "]") {
        e.preventDefault();
        const idx = sessions.findIndex((s) => s.id === activeSessionId);
        if (idx >= 0 && idx < sessions.length - 1) {
          setActiveSession(sessions[idx + 1].id);
        }
        return;
      }

      // Ctrl+[ / Cmd+[: Previous session tab
      if (mod && e.key === "[") {
        e.preventDefault();
        const idx = sessions.findIndex((s) => s.id === activeSessionId);
        if (idx > 0) {
          setActiveSession(sessions[idx - 1].id);
        }
        return;
      }

      // Ctrl+W / Cmd+W: Close active session
      if (mod && e.key.toLowerCase() === "w" && !e.shiftKey) {
        e.preventDefault();
        if (activeSessionId) {
          invoke("ssh_disconnect", { sessionId: activeSessionId }).catch(() => {});
          closeSession(activeSessionId);
        }
        return;
      }

      // Ctrl+= / Cmd+=: Increase font size
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        updateSettings({ fontSize: Math.min(fontSize + 1, 24) });
        return;
      }

      // Ctrl+- / Cmd+-: Decrease font size
      if (mod && e.key === "-") {
        e.preventDefault();
        updateSettings({ fontSize: Math.max(fontSize - 1, 10) });
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sessions, activeSessionId, fontSize, setActiveSession, closeSession, updateSettings]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  if (sessions.length === 0) {
    return (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "text.secondary" }}>
        <TerminalRounded sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
        <Typography variant="subtitle1">No active terminal sessions</Typography>
        <Typography variant="caption">Connect to a server from the sidebar</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Tab bar */}
      <Box sx={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${preset.divider}`, minHeight: 34, flexShrink: 0 }}>
        <Tabs
          value={activeSessionId || false}
          onChange={(_, v) => setActiveSession(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 34, flex: 1 }}
        >
          {sessions.map((session) => (
            <Tab
              key={session.id}
              value={session.id}
              sx={{ minHeight: 34, py: 0, px: 1.5, fontSize: 12 }}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <SessionStatusDot status={session.status} preset={preset} />
                  <Typography variant="caption" noWrap sx={{ maxWidth: 110, fontSize: 12 }}>
                    {session.serverName}
                  </Typography>
                  <IconButton
                    sx={{ p: 0.25, ml: 0.25 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (session.status === "connected" || session.status === "connecting") {
                        invoke("ssh_disconnect", { sessionId: session.id }).catch(() => {});
                      }
                      closeSession(session.id);
                    }}
                  >
                    <CloseRounded sx={{ fontSize: 13 }} />
                  </IconButton>
                </Box>
              }
            />
          ))}
        </Tabs>
        {/* Toggle buttons for side panels */}
        <Box sx={{ display: "flex", pr: 0.5, gap: 0.25, alignItems: "center" }}>
          {/* Tab navigation arrows */}
          {sessions.length > 1 && (
            <Box sx={{ display: "flex", mr: 0.25 }}>
              <Tooltip title="Previous Tab (Ctrl+[)">
                <IconButton sx={{ p: 0.25 }} onClick={() => {
                  const idx = sessions.findIndex((s) => s.id === activeSessionId);
                  if (idx > 0) setActiveSession(sessions[idx - 1].id);
                }}>
                  <ChevronLeftRounded sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Next Tab (Ctrl+])">
                <IconButton sx={{ p: 0.25 }} onClick={() => {
                  const idx = sessions.findIndex((s) => s.id === activeSessionId);
                  if (idx >= 0 && idx < sessions.length - 1) setActiveSession(sessions[idx + 1].id);
                }}>
                  <ChevronRightRounded sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          <Tooltip title="Command Palette (Ctrl+Shift+P)">
            <IconButton
              onClick={() => setPaletteOpen(true)}
              sx={{ p: 0.5 }}
            >
              <KeyboardCommandKeyRounded sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="SFTP File Browser">
            <IconButton
              onClick={() => setShowFiles(!showFiles)}
              color={showFiles ? "primary" : "default"}
              sx={{ p: 0.5 }}
            >
              <FolderRounded sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Port Forward">
            <IconButton
              onClick={() => setShowForward(!showForward)}
              color={showForward ? "primary" : "default"}
              sx={{ p: 0.5 }}
            >
              <AltRouteRounded sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Server Monitor">
            <IconButton
              onClick={() => setShowStats(!showStats)}
              color={showStats ? "primary" : "default"}
              sx={{ p: 0.5 }}
            >
              <MonitorHeartRounded sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="AI Assistant">
            <IconButton
              onClick={() => setShowAI(!showAI)}
              color={showAI ? "primary" : "default"}
              sx={{ p: 0.5 }}
            >
              <AutoAwesomeRounded sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Main split: terminal + optional file panel */}
      <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Terminal panes */}
        <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {sessions.map((session) => (
            <TerminalPane
              key={session.id}
              session={session}
              server={getServerById(session.serverId) || null}
              active={session.id === activeSessionId}
              fontSize={fontSize}
              scrollback={scrollback}
              termTheme={termTheme}
              preset={preset}
              onStatusChange={(status, error) => setSessionStatus(session.id, status, error)}
            />
          ))}
        </Box>

        {/* SFTP File panel (right side, togglable) */}
        {showFiles && activeSession && (
          <Box
            sx={{
              width: 460,
              minWidth: 460,
              borderLeft: `1px solid ${preset.divider}`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <FileManager key={activeSession.id} sessionId={activeSession.id} />
          </Box>
        )}

        {/* Right sidebar: Server Stats + Port Forward + AI Assistant (stacked vertically) */}
        {(showStats || showForward || showAI) && activeSession && (
          <Box
            sx={{
              width: 320,
              minWidth: 320,
              borderLeft: `1px solid ${preset.divider}`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {showStats && (
              <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", borderBottom: (showForward || showAI) ? `1px solid ${preset.divider}` : "none" }}>
                <ServerStatsPanel key={activeSession.id} sessionId={activeSession.id} />
              </Box>
            )}
            {showAI && (
              <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", borderBottom: showForward ? `1px solid ${preset.divider}` : "none" }}>
                <ChatAgent key={activeSession.id} sessionId={activeSession.id} />
              </Box>
            )}
            {showForward && (
              <Box sx={{ flexShrink: 0, maxHeight: "40%", overflow: "auto" }}>
                <PortForwardPanel sessionId={activeSession.id} serverName={activeSession.serverName} preset={preset} />
              </Box>
            )}
          </Box>
        )}

      </Box>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onToggleFiles={() => setShowFiles((o) => !o)}
        onToggleStats={() => setShowStats((o) => !o)}
        onToggleForward={() => setShowForward((o) => !o)}
        onToggleAI={() => setShowAI((o) => !o)}
        onAddServer={() => useStore.getState().setView("assets")}
      />
    </Box>
  );
}

function SessionStatusDot({ status, preset }: { status: TerminalSession["status"]; preset: ThemePreset }) {
  const colors = {
    connected: preset.success,
    connecting: preset.warning,
    disconnected: preset.text.secondary,
    error: preset.error,
  };
  return <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: colors[status], flexShrink: 0 }} />;
}

// --- Port Forward Panel ---

function PortForwardPanel({ sessionId, serverName, preset }: { sessionId: string; serverName: string; preset: ThemePreset }) {
  const portForwards = useStore((s) => s.portForwards);
  const addPortForward = useStore((s) => s.addPortForward);
  const deletePortForward = useStore((s) => s.deletePortForward);
  const updatePortForward = useStore((s) => s.updatePortForward);
  const sessionForwards = portForwards.filter((pf) => pf.sessionId === sessionId);
  const runningCount = sessionForwards.filter((pf) => pf.running).length;
  const [showAddForm, setShowAddForm] = useState(false);
  const [direction, setDirection] = useState<"local" | "remote">("local");
  const [form, setForm] = useState({ localPort: "", remoteHost: "127.0.0.1", remotePort: "" });

  const handleToggleForward = async (pf: PortForward) => {
    if (pf.running) {
      await invoke("stop_port_forward", { sessionId: pf.sessionId, forwardId: pf.id }).catch(() => {});
      updatePortForward(pf.id, { running: false });
    } else {
      try {
        await invoke("start_port_forward", {
          sessionId: pf.sessionId, forwardId: pf.id,
          direction: pf.direction,
          localHost: "127.0.0.1", localPort: pf.localPort,
          remoteHost: pf.remoteHost, remotePort: pf.remotePort,
        });
        updatePortForward(pf.id, { running: true });
      } catch (e) { console.error(e); }
    }
  };

  const handleAdd = () => {
    const lp = parseInt(form.localPort);
    const rp = parseInt(form.remotePort);
    if (!lp || !rp || !form.remoteHost) return;
    addPortForward({
      id: generateId("pf"), name: `${form.remoteHost}:${rp}`,
      sessionId, serverName, direction,
      localHost: "127.0.0.1", localPort: lp,
      remoteHost: form.remoteHost, remotePort: rp, enabled: true,
    });
    setForm({ localPort: "", remoteHost: "127.0.0.1", remotePort: "" });
    setShowAddForm(false);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", bgcolor: preset.background.paper }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" sx={{ px: 1, py: 0.5, flexShrink: 0 }}>
        <AltRouteRounded sx={{ fontSize: 14, color: preset.primary, mr: 0.5 }} />
        <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: preset.primary, flex: 1 }}>
          Port Forward
        </Typography>
        <Chip label={sessionForwards.length} size="small" sx={{ height: 16, fontSize: 10 }} />
        {runningCount > 0 && (
          <Chip label={`${runningCount} on`} size="small" color="success" sx={{ height: 16, fontSize: 10, ml: 0.25 }} />
        )}
        <Tooltip title="Add Rule">
          <IconButton sx={{ p: 0.25, ml: 0.25 }} onClick={() => setShowAddForm(!showAddForm)}>
            <AddRounded sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Add form */}
      {showAddForm && (
        <Box sx={{ px: 1, pb: 0.5 }}>
          <Stack direction="column" spacing={0.5}>
            {/* Direction toggle */}
            <Stack direction="row" spacing={0.5}>
              <Button
                size="small"
                variant={direction === "local" ? "contained" : "outlined"}
                onClick={() => setDirection("local")}
                sx={{ fontSize: 10, textTransform: "none", flex: 1, py: 0.25 }}
              >
                Local → Remote
              </Button>
              <Button
                size="small"
                variant={direction === "remote" ? "contained" : "outlined"}
                onClick={() => setDirection("remote")}
                sx={{ fontSize: 10, textTransform: "none", flex: 1, py: 0.25 }}
              >
                Remote → Local
              </Button>
            </Stack>
            <TextField size="small" label={direction === "local" ? "Local Port" : "Local Port (on your machine)"} type="number" value={form.localPort} onChange={(e) => setForm({ ...form, localPort: e.target.value })} sx={{ "& .MuiOutlinedInput-input": { fontSize: 11, padding: "4px 8px", fontFamily: "monospace" }, "& .MuiInputLabel": { fontSize: 10 } }} />
            <TextField size="small" label={direction === "local" ? "Remote Host (on server)" : "Remote Host (on server)"} value={form.remoteHost} onChange={(e) => setForm({ ...form, remoteHost: e.target.value })} sx={{ "& .MuiOutlinedInput-input": { fontSize: 11, padding: "4px 8px", fontFamily: "monospace" }, "& .MuiInputLabel": { fontSize: 10 } }} />
            <TextField size="small" label="Remote Port" type="number" value={form.remotePort} onChange={(e) => setForm({ ...form, remotePort: e.target.value })} sx={{ "& .MuiOutlinedInput-input": { fontSize: 11, padding: "4px 8px", fontFamily: "monospace" }, "& .MuiInputLabel": { fontSize: 10 } }} />
            <Stack direction="row" spacing={0.5}>
              <Button size="small" variant="contained" onClick={handleAdd} disabled={!form.localPort || !form.remotePort} sx={{ fontSize: 11, textTransform: "none", flex: 1 }}>Add</Button>
              <Button size="small" onClick={() => setShowAddForm(false)} sx={{ fontSize: 11, textTransform: "none" }}>Cancel</Button>
            </Stack>
          </Stack>
        </Box>
      )}

      {/* Forward list */}
      <Box sx={{ overflow: "auto" }}>
        {sessionForwards.length === 0 && !showAddForm ? (
          <Typography variant="caption" sx={{ display: "block", px: 1.5, py: 0.75, color: preset.text.secondary, fontStyle: "italic", fontSize: 10 }}>
            No port forwards. Click + to add one.
          </Typography>
        ) : (
          sessionForwards.map((pf) => (
            <Box
              key={pf.id}
              sx={{
                display: "flex", alignItems: "center", gap: 0.5,
                px: 1, py: 0.4,
                borderBottom: `1px solid ${preset.divider}`,
                "&:hover": { bgcolor: `${preset.primary}08` },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontFamily: "monospace", fontSize: 10.5, color: preset.text.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {pf.direction === "remote" ? (
                    <>{pf.remoteHost}:{pf.remotePort} <ArrowForwardRounded sx={{ fontSize: 9, verticalAlign: "middle", color: pf.running ? preset.success : preset.text.secondary }} /> :{pf.localPort}</>
                  ) : (
                    <>:{pf.localPort} <ArrowForwardRounded sx={{ fontSize: 9, verticalAlign: "middle", color: pf.running ? preset.success : preset.text.secondary }} /> {pf.remoteHost}:{pf.remotePort}</>
                  )}
                </Typography>
                <Typography sx={{ fontSize: 8, color: pf.direction === "remote" ? preset.warning : preset.text.secondary, fontWeight: 600 }}>
                  {pf.direction === "remote" ? "remote → local" : "local → remote"}
                </Typography>
              </Box>
              <Tooltip title={pf.running ? "Stop" : "Start"}>
                <IconButton size="small" color={pf.running ? "error" : "success"} onClick={() => handleToggleForward(pf)} sx={{ p: 0.25 }}>
                  {pf.running ? <StopRounded sx={{ fontSize: 13 }} /> : <PlayArrowRounded sx={{ fontSize: 13 }} />}
                </IconButton>
              </Tooltip>
              <IconButton size="small" sx={{ p: 0.25 }} onClick={() => deletePortForward(pf.id)}>
                <CloseRounded sx={{ fontSize: 12 }} />
              </IconButton>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

// --- Terminal Pane ---

interface TerminalPaneProps {
  session: TerminalSession;
  server: ServerAsset | null;
  active: boolean;
  fontSize: number;
  scrollback: number;
  termTheme: ThemePreset["terminal"];
  preset: ThemePreset;
  onStatusChange: (status: TerminalSession["status"], error?: string) => void;
}

function TerminalPane({ session, server, active, fontSize, scrollback, termTheme, preset, onStatusChange }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const unlistenClosedRef = useRef<UnlistenFn | null>(null);
  const statusRef = useRef<TerminalSession["status"]>("connecting");
  const connectRetryRef = useRef(0);

  const doConnect = (term: Terminal, srv: ServerAsset, sid: string) => {
    const config = {
      host: srv.host, port: srv.port, username: srv.username,
      auth_method: srv.authMethod, password: srv.password,
      private_key_path: srv.privateKeyPath, private_key_passphrase: srv.privateKeyPassphrase,
    };

    statusRef.current = "connecting";
    onStatusChange("connecting");
    term.writeln(`\x1b[2mConnecting to ${srv.username}@${srv.host}:${srv.port}...\x1b[0m`);

    invoke("ssh_connect", { sessionId: sid, config })
      .then(() => {
        statusRef.current = "connected";
        onStatusChange("connected");
        term.writeln(`\x1b[32m✓ Connected to ${srv.host}\x1b[0m\r\n`);

        // Get initial CWD via ssh_exec
        invoke<string>("ssh_exec", { sessionId: sid, command: "pwd" })
          .then((out) => {
            const cwd = out.trim();
            if (cwd) {
              setRemoteCwd(session.id, cwd);
            }
          })
          .catch(() => {});

        // Auto-start port forwards associated with this session
        const allForwards = useStore.getState().portForwards.filter((pf) => pf.sessionId === sid);
        allForwards.forEach((pf) => {
          invoke("start_port_forward", {
            sessionId: pf.sessionId, forwardId: pf.id,
            direction: pf.direction,
            localHost: "127.0.0.1", localPort: pf.localPort,
            remoteHost: pf.remoteHost, remotePort: pf.remotePort,
          })
            .then(() => {
              useStore.getState().updatePortForward(pf.id, { running: true });
              term.writeln(`\x1b[2m  ↳ Port forward started: ${pf.direction === "remote" ? `${pf.remoteHost}:${pf.remotePort} → :${pf.localPort}` : `:${pf.localPort} → ${pf.remoteHost}:${pf.remotePort}`}\x1b[0m`);
            })
            .catch((e) => term.writeln(`\x1b[31m  ↳ Port forward failed: ${e}\x1b[0m`));
        });
      })
      .catch((err) => {
        statusRef.current = "error";
        onStatusChange("error", String(err));
        term.writeln(`\x1b[31m✗ Connection failed: ${err}\x1b[0m`);
        term.writeln(`\x1b[2mClick here to reconnect...\x1b[0m`);
      });
  };

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new Terminal({
      fontSize,
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
      cursorBlink: true,
      scrollback,
      theme: termTheme,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;
    registerTerminal(session.id, term);

    if (!server) {
      statusRef.current = "error";
      onStatusChange("error", "Server configuration not found");
      term.writeln("\x1b[31mError: Server configuration not found\x1b[0m");
      return;
    }

    // Initial connection
    doConnect(term, server, session.id);

    // Listen for incoming data
    listen(`ssh:data:${session.id}`, (event) => {
      term.write(event.payload as string);
    }).then((fn) => { unlistenRef.current = fn; });

    // Listen for connection closed
    listen(`ssh:closed:${session.id}`, () => {
      statusRef.current = "disconnected";
      onStatusChange("disconnected");
      term.writeln("\r\n\x1b[33m⚡ Connection closed. Click here to reconnect.\x1b[0m");
    }).then((fn) => { unlistenClosedRef.current = fn; });

    // Normal interactive terminal: forward all input to SSH
    term.onData((data) => {
      if (statusRef.current === "connected") {
        invoke("ssh_write", { sessionId: session.id, data }).catch(() => {});
        // Detect Enter key: check if the user ran a cd command
        if (data.includes("\r")) {
          const buffer = term.buffer.active;
          const lineY = buffer.baseY + buffer.cursorY;
          const line = buffer.getLine(lineY);
          if (line) {
            const text = line.translateToString(true);
            // Match cd command: (after prompt) cd [target]
            const match = text.match(/\bcd(?:\s+(.+?))?\s*$/);
            if (match) {
              const target = (match[1] || "").trim().replace(/^["']|["']$/g, "");
              // Resolve via ssh_exec: cd to target on a fresh channel, then pwd.
              // This returns the *real* absolute path and naturally handles failures
              // (if cd fails, the command returns nothing and we skip the update).
              const actualSid = getActualSessionId(session.id);
              const cmd = `cd ${target.includes("'") || target.includes('"') ? target : JSON.stringify(target)} 2>/dev/null && pwd`;
              // Delay to let the user's cd execute first in the PTY shell
              setTimeout(() => {
                invoke<string>("ssh_exec", { sessionId: actualSid, command: cmd })
                  .then((out) => {
                    const realCwd = out.trim();
                    if (realCwd && realCwd.startsWith("/")) {
                      setRemoteCwd(session.id, realCwd);
                    }
                  })
                  .catch(() => {});
              }, 300);
            }
          }
        }
      } else if (statusRef.current === "disconnected" || statusRef.current === "error") {
        // Reconnect on any keypress
        connectRetryRef.current += 1;
        const newSid = `${session.id}-r${connectRetryRef.current}`;
        updateActualSessionId(session.id, newSid);
        term.writeln("");
        doConnect(term, server, newSid);

        listen(`ssh:data:${newSid}`, (event) => {
          term.write(event.payload as string);
        }).then((fn) => {
          if (unlistenRef.current) unlistenRef.current();
          unlistenRef.current = fn;
        });

        listen(`ssh:closed:${newSid}`, () => {
          statusRef.current = "disconnected";
          onStatusChange("disconnected");
          term.writeln("\r\n\x1b[33m⚡ Connection closed. Type to reconnect.\x1b[0m");
        }).then((fn) => {
          if (unlistenClosedRef.current) unlistenClosedRef.current();
          unlistenClosedRef.current = fn;
        });
      }
    });

    term.onResize(({ cols, rows }) => {
      if (statusRef.current === "connected") {
        invoke("ssh_resize", { sessionId: session.id, cols, rows }).catch(() => {});
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (fitRef.current) { try { fitRef.current.fit(); } catch {} }
    });
    resizeObserver.observe(containerRef.current);

    // Focus terminal when it becomes active
    if (active) {
      setTimeout(() => { try { term.focus(); } catch {} }, 50);
    }

    return () => {
      resizeObserver.disconnect();
      if (unlistenRef.current) unlistenRef.current();
      if (unlistenClosedRef.current) unlistenClosedRef.current();
      unregisterTerminal(session.id);
      if (statusRef.current === "connected") {
        invoke("ssh_disconnect", { sessionId: session.id }).catch(() => {});
      }
      term.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.display = active ? "block" : "none";
      if (active && fitRef.current) {
        setTimeout(() => {
          try { fitRef.current?.fit(); termRef.current?.focus(); } catch {}
        }, 30);
      }
    }
  }, [active]);

  const rowHeight = Math.round(fontSize * 1.3);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "absolute", inset: 0,
        display: active ? "block" : "none",
        "& .xterm": { padding: "4px 8px", fontSize: `${fontSize}px !important` },
        "& .xterm-viewport::-webkit-scrollbar": { width: 6 },
        "& .xterm-viewport::-webkit-scrollbar-thumb": { bgcolor: preset.divider, borderRadius: 3 },
        // Zebra stripe overlay
        "& .xterm-screen::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent ${rowHeight - 1}px,
            ${preset.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"} ${rowHeight - 1}px,
            ${preset.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"} ${rowHeight}px
          )`,
        },
      }}
    />
  );
}
