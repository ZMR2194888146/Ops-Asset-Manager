import { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  Box,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
} from "@mui/material";
import {
  SearchRounded,
  TerminalRounded,
  DnsRounded,
  CodeRounded,
  SettingsRounded,
  FolderRounded,
  AddRounded,
  DownloadRounded,
  PowerSettingsNewRounded,
  PaletteRounded,
  AltRouteRounded,
  AutoAwesomeRounded,
  CloseRounded,
  KeyboardCommandKeyRounded,
} from "@mui/icons-material";
import { useStore } from "../stores/store";
import type { ViewType } from "../types";

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  group: string;
  keywords?: string;
  shortcut?: string;
  perform: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onToggleFiles: () => void;
  onToggleStats: () => void;
  onToggleForward: () => void;
  onToggleAI: () => void;
  onAddServer: () => void;
}

export function CommandPalette({ open, onClose, onToggleFiles, onToggleStats, onToggleForward, onToggleAI, onAddServer }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const setView = useStore((s) => s.setView);
  const servers = useStore((s) => s.servers);
  const openSession = useStore((s) => s.openSession);
  const sessions = useStore((s) => s.sessions);
  const themeId = useStore((s) => s.settings.themeId);
  const updateSettings = useStore((s) => s.updateSettings);

  const actions = useMemo<PaletteAction[]>(() => {
    const navActions: PaletteAction[] = [
      { id: "nav-assets", label: "Go to Assets", icon: <DnsRounded />, group: "Navigate", keywords: "server asset manage", perform: () => setView("assets") },
      { id: "nav-terminal", label: "Go to Terminals", icon: <TerminalRounded />, group: "Navigate", keywords: "ssh terminal console", perform: () => setView("terminal") },
      { id: "nav-snippets", label: "Go to Snippets", icon: <CodeRounded />, group: "Navigate", keywords: "command snippet", perform: () => setView("snippets") },
      { id: "nav-settings", label: "Go to Settings", icon: <SettingsRounded />, group: "Navigate", keywords: "config theme font", perform: () => setView("settings") },
    ];

    const serverActions: PaletteAction[] = servers.slice(0, 8).map((s) => ({
      id: `connect-${s.id}`,
      label: `Connect: ${s.name}`,
      hint: `${s.username}@${s.host}:${s.port}`,
      icon: <PowerSettingsNewRounded />,
      group: "Connect",
      keywords: `ssh ${s.host} ${s.username} ${s.group || ""}`,
      perform: () => { openSession(s); setView("terminal"); },
    }));

    const toolActions: PaletteAction[] = [
      { id: "toggle-files", label: "Toggle SFTP File Browser", icon: <FolderRounded />, group: "Tools", keywords: "sftp file upload download", perform: onToggleFiles },
      { id: "toggle-stats", label: "Toggle Server Monitor", icon: <PaletteRounded />, group: "Tools", keywords: "cpu memory monitor stats", perform: onToggleStats },
      { id: "toggle-forward", label: "Toggle Port Forward", icon: <AltRouteRounded />, group: "Tools", keywords: "port forward tunnel proxy", perform: onToggleForward },
      { id: "toggle-ai", label: "Toggle AI Assistant", icon: <AutoAwesomeRounded />, group: "Tools", keywords: "ai assistant chat help", perform: onToggleAI },
      { id: "add-server", label: "Add New Server", icon: <AddRounded />, group: "Tools", keywords: "create new server", perform: onAddServer },
      { id: "export-json", label: "Export Config (JSON)", icon: <DownloadRounded />, group: "Tools", keywords: "export backup json", perform: () => { setView("settings"); } },
      { id: "export-ssh", label: "Export SSH Config", icon: <DownloadRounded />, group: "Tools", keywords: "export ssh config openssh", perform: () => { setView("settings"); } },
    ];

    const themeActions: PaletteAction[] = [
      "warp-dark", "warp-light", "warp-vintage",
      "github-dark", "dracula", "one-dark", "monokai", "nord", "tokyo-night", "catppuccin-mocha", "light-clean", "solarized-light",
    ].map((id) => ({
      id: `theme-${id}`,
      label: `Theme: ${id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      icon: <PaletteRounded />,
      group: "Theme",
      keywords: `theme color ${id}`,
      perform: () => updateSettings({ themeId: id }),
    }));

    return [...serverActions, ...navActions, ...toolActions, ...themeActions];
  }, [servers, sessions, setView, openSession, onToggleFiles, onToggleStats, onToggleForward, onToggleAI, onAddServer, updateSettings]);

  const filtered = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter((a) =>
      a.label.toLowerCase().includes(q) ||
      a.group.toLowerCase().includes(q) ||
      a.keywords?.toLowerCase().includes(q) ||
      a.hint?.toLowerCase().includes(q)
    );
  }, [actions, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const action = filtered[selectedIdx];
        if (action) { action.perform(); onClose(); }
      } else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selectedIdx, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const groups = filtered.reduce((acc, a) => {
    if (!acc[a.group]) acc[a.group] = [];
    acc[a.group].push(a);
    return acc;
  }, {} as Record<string, PaletteAction[]>);

  let runningIdx = 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          position: "absolute",
          top: 80,
          margin: 0,
          maxWidth: 560,
          width: "100%",
          alignSelf: "center",
        },
      }}
      BackdropProps={{ sx: { bgcolor: "rgba(0,0,0,0.3)" } }}
    >
      <TextField
        inputRef={inputRef}
        fullWidth
        autoFocus
        placeholder="Type a command or search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ "& .MuiOutlinedInput-root": { fontSize: 14, padding: "8px 12px", borderRadius: "8px 8px 0 0", "& fieldset": { border: "none", borderBottom: `1px solid`, borderColor: "divider" } } }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment>,
          endAdornment: (
            <InputAdornment position="end">
              <Chip label="ESC" size="small" sx={{ height: 18, fontSize: 9, bgcolor: "divider" }} />
            </InputAdornment>
          ),
        }}
      />
      <Box ref={listRef} sx={{ maxHeight: 400, overflowY: "auto", py: 0.5 }}>
        {filtered.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", py: 3 }}>
            No results for "{query}"
          </Typography>
        ) : (
          Object.entries(groups).map(([group, groupActions]) => (
            <Box key={group}>
              <Typography variant="caption" sx={{ px: 2, py: 0.5, display: "block", fontWeight: 600, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5, color: "text.secondary" }}>
                {group}
              </Typography>
              <List dense disablePadding>
                {groupActions.map((action) => {
                  const idx = runningIdx++;
                  return (
                    <ListItemButton
                      key={action.id}
                      data-idx={idx}
                      selected={idx === selectedIdx}
                      onClick={() => { action.perform(); onClose(); }}
                      sx={{ py: 0.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, fontSize: 16 }}>
                        {action.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={action.label}
                        secondary={action.hint}
                        primaryTypographyProps={{ fontSize: 12.5 }}
                        secondaryTypographyProps={{ fontSize: 10, fontFamily: "monospace", color: "text.secondary" }}
                      />
                      {action.shortcut && (
                        <Chip label={action.shortcut} size="small" sx={{ height: 16, fontSize: 9, bgcolor: "divider" }} />
                      )}
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          ))
        )}
      </Box>
    </Dialog>
  );
}
