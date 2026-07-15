import { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Collapse,
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
  KeyboardArrowDownRounded,
  KeyboardArrowUpRounded,
  FolderRounded,
  MonitorHeartRounded,
  KeyboardCommandKeyRounded,
} from "@mui/icons-material";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useStore } from "../stores/store";
import { RichInputBar } from "./RichInputBar";
import { ServerStatsPanel } from "./ServerStatsPanel";
import { FileManager } from "./FileManager";
import { CommandPalette } from "./CommandPalette";
import { generateId } from "../utils/id";
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
  const preset = getThemePreset(themeId);
  const termTheme = preset.terminal;

  const [showFiles, setShowFiles] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global shortcut: Ctrl+Shift+P / Cmd+Shift+P
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
        <Box sx={{ display: "flex", pr: 0.5, gap: 0.25 }}>
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
          <Tooltip title="Server Monitor">
            <IconButton
              onClick={() => setShowStats(!showStats)}
              color={showStats ? "primary" : "default"}
              sx={{ p: 0.5 }}
            >
              <MonitorHeartRounded sx={{ fontSize: 17 }} />
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

        {/* Server Stats panel (right side, togglable) */}
        {showStats && activeSession && (
          <Box
            sx={{
              width: 300,
              minWidth: 300,
              borderLeft: `1px solid ${preset.divider}`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <ServerStatsPanel key={activeSession.id} sessionId={activeSession.id} />
          </Box>
        )}
      </Box>

      {/* Port Forward panel + Snippet bar */}
      {activeSession && (
        <PortForwardPanel sessionId={activeSession.id} serverName={activeSession.serverName} preset={preset} />
      )}
      {activeSession && <RichInputBar sessionId={activeSession.id} />}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onToggleFiles={() => setShowFiles((o) => !o)}
        onToggleStats={() => setShowStats((o) => !o)}
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
  const sessionForwards = portForwards.filter((pf) => pf.sessionId === sessionId);
  const [expanded, setExpanded] = useState(false);
  const [runningStates, setRunningStates] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ localPort: "", remoteHost: "127.0.0.1", remotePort: "" });

  const handleToggleForward = async (pf: PortForward) => {
    if (runningStates[pf.id]) {
      await invoke("stop_port_forward", { sessionId: pf.sessionId, forwardId: pf.id }).catch(() => {});
      setRunningStates((p) => ({ ...p, [pf.id]: false }));
    } else {
      try {
        await invoke("start_port_forward", {
          sessionId: pf.sessionId, forwardId: pf.id,
          localHost: "127.0.0.1", localPort: pf.localPort,
          remoteHost: pf.remoteHost, remotePort: pf.remotePort,
        });
        setRunningStates((p) => ({ ...p, [pf.id]: true }));
      } catch (e) { console.error(e); }
    }
  };

  const handleAdd = () => {
    const lp = parseInt(form.localPort);
    const rp = parseInt(form.remotePort);
    if (!lp || !rp || !form.remoteHost) return;
    addPortForward({
      id: generateId("pf"), name: `${form.remoteHost}:${rp}`,
      sessionId, serverName, localHost: "127.0.0.1", localPort: lp,
      remoteHost: form.remoteHost, remotePort: rp, enabled: true,
    });
    setForm({ localPort: "", remoteHost: "127.0.0.1", remotePort: "" });
    setShowAddForm(false);
  };

  return (
    <Box sx={{ borderTop: `1px solid ${preset.divider}`, background: preset.background.default, flexShrink: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", px: 1, py: 0.25, cursor: "pointer", userSelect: "none" }} onClick={() => setExpanded(!expanded)}>
        <AltRouteRounded sx={{ fontSize: 14, color: "primary.main", mr: 0.5 }} />
        <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, flex: 1 }}>Port Forward</Typography>
        <Chip label={sessionForwards.length} size="small" sx={{ height: 16, fontSize: 10, mr: 0.5 }} />
        {Object.values(runningStates).filter(Boolean).length > 0 && (
          <Chip label={`${Object.values(runningStates).filter(Boolean).length} active`} size="small" color="success" sx={{ height: 16, fontSize: 10, mr: 0.5 }} />
        )}
        <IconButton sx={{ p: 0.25 }} onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
          {expanded ? <KeyboardArrowDownRounded sx={{ fontSize: 15 }} /> : <KeyboardArrowUpRounded sx={{ fontSize: 15 }} />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 1, pb: 0.5 }}>
          {sessionForwards.map((pf) => (
            <Box key={pf.id} sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.25 }}>
              <Typography sx={{ fontFamily: "monospace", fontSize: 11, flex: 1 }}>
                127.0.0.1:{pf.localPort}
                <ArrowForwardRounded sx={{ fontSize: 10, mx: 0.25, verticalAlign: "middle", color: runningStates[pf.id] ? "success.main" : "text.disabled" }} />
                {pf.remoteHost}:{pf.remotePort}
              </Typography>
              <Tooltip title={runningStates[pf.id] ? "Stop" : "Start"}>
                <IconButton size="small" color={runningStates[pf.id] ? "error" : "success"} onClick={() => handleToggleForward(pf)} sx={{ p: 0.25 }}>
                  {runningStates[pf.id] ? <StopRounded sx={{ fontSize: 14 }} /> : <PlayArrowRounded sx={{ fontSize: 14 }} />}
                </IconButton>
              </Tooltip>
              <IconButton size="small" sx={{ p: 0.25 }} onClick={() => deletePortForward(pf.id)}>
                <CloseRounded sx={{ fontSize: 13 }} />
              </IconButton>
            </Box>
          ))}

          {showAddForm ? (
            <Stack direction="row" spacing={0.5} sx={{ py: 0.25, alignItems: "center" }}>
              <TextField size="small" placeholder="Local" type="number" value={form.localPort} onChange={(e) => setForm({ ...form, localPort: e.target.value })} sx={{ width: 70, "& .MuiOutlinedInput-input": { fontSize: 11, padding: "3px 6px", fontFamily: "monospace" } }} />
              <ArrowForwardRounded sx={{ fontSize: 12, color: "text.secondary" }} />
              <TextField size="small" placeholder="Host" value={form.remoteHost} onChange={(e) => setForm({ ...form, remoteHost: e.target.value })} sx={{ width: 100, "& .MuiOutlinedInput-input": { fontSize: 11, padding: "3px 6px", fontFamily: "monospace" } }} />
              <TextField size="small" placeholder="Port" type="number" value={form.remotePort} onChange={(e) => setForm({ ...form, remotePort: e.target.value })} sx={{ width: 60, "& .MuiOutlinedInput-input": { fontSize: 11, padding: "3px 6px", fontFamily: "monospace" } }} />
              <Button size="small" variant="contained" onClick={handleAdd} disabled={!form.localPort || !form.remotePort}>Add</Button>
              <Button size="small" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </Stack>
          ) : (
            <Button size="small" startIcon={<AddRounded sx={{ fontSize: 14 }} />} onClick={() => setShowAddForm(true)} sx={{ fontSize: 11, textTransform: "none", mt: 0.25 }}>
              Add Rule
            </Button>
          )}
        </Box>
      </Collapse>
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
      })
      .catch((err) => {
        statusRef.current = "error";
        onStatusChange("error", String(err));
        term.writeln(`\x1b[31m✗ Connection failed: ${err}\x1b[0m`);
        term.writeln(`\x1b[2mPress any key to reconnect...\x1b[0m`);
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
      term.writeln("\r\n\x1b[33m⚡ Connection closed. Press any key to reconnect.\x1b[0m");
    }).then((fn) => { unlistenClosedRef.current = fn; });

    // Terminal input handler — reconnect if disconnected/error
    term.onData((data) => {
      if (statusRef.current === "connected") {
        invoke("ssh_write", { sessionId: session.id, data }).catch(() => {});
      } else if (statusRef.current === "disconnected" || statusRef.current === "error") {
        // Reconnect: generate a new session id to avoid backend conflict
        connectRetryRef.current += 1;
        const newSid = `${session.id}-r${connectRetryRef.current}`;
        session.id = newSid;
        term.writeln("");
        doConnect(term, server, newSid);

        // Re-register event listeners for the new session id
        listen(`ssh:data:${newSid}`, (event) => {
          term.write(event.payload as string);
        }).then((fn) => {
          if (unlistenRef.current) unlistenRef.current();
          unlistenRef.current = fn;
        });

        listen(`ssh:closed:${newSid}`, () => {
          statusRef.current = "disconnected";
          onStatusChange("disconnected");
          term.writeln("\r\n\x1b[33m⚡ Connection closed. Press any key to reconnect.\x1b[0m");
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

    return () => {
      resizeObserver.disconnect();
      if (unlistenRef.current) unlistenRef.current();
      if (unlistenClosedRef.current) unlistenClosedRef.current();
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
        // Zebra stripe overlay — sits above the canvas with pointer-events disabled
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
