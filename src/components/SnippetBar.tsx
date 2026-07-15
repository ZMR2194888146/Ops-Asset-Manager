import { useState, useRef } from "react";
import {
  Box,
  Chip,
  Popper,
  Paper,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  Typography,
  ClickAwayListener,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  BoltRounded,
  SearchRounded,
  SendRounded,
  TerminalRounded,
  CodeRounded,
} from "@mui/icons-material";
import { useStore } from "../stores/store";
import { getThemePreset } from "../theme/presets";
import { invoke } from "@tauri-apps/api/core";

interface SnippetBarProps {
  sessionId: string;
}

export function SnippetBar({ sessionId }: SnippetBarProps) {
  const snippets = useStore((s) => s.snippets);
  const themeId = useStore((s) => s.settings.themeId);
  const preset = getThemePreset(themeId);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const anchorRef = useRef<HTMLDivElement>(null);

  const filteredSnippets = snippets.filter(
    (s) =>
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.command.toLowerCase().includes(filter.toLowerCase()) ||
      s.category?.toLowerCase().includes(filter.toLowerCase())
  );

  const categories = [...new Set(filteredSnippets.map((s) => s.category).filter(Boolean))] as string[];

  const handleSend = (text?: string) => {
    const cmd = text ?? input;
    if (!cmd) return;
    invoke("ssh_write", { sessionId, data: cmd + "\n" }).catch(() => {});
    setInput(""); setOpen(false); setFilter("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (open && filteredSnippets.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filteredSnippets.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); const snip = filteredSnippets[selectedIdx]; if (snip) handleSend(snip.command); }
      else if (e.key === "Escape") { setOpen(false); }
    } else if (e.key === "Enter") { e.preventDefault(); handleSend(); }
  };

  const showSuggestion = input.startsWith("/") || input.startsWith(">");

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box ref={anchorRef} sx={{ borderTop: `1px solid ${preset.divider}`, px: 1, py: 0.5, display: "flex", alignItems: "center", gap: 0.75, background: preset.background.default }}>
        <Tooltip title="Type / to search snippets">
          <BoltRounded color="primary" sx={{ fontSize: 16 }} />
        </Tooltip>

        <TextField
          fullWidth
          size="small"
          placeholder="Type a command, or / for snippets..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (e.target.value.startsWith("/") || e.target.value.startsWith(">")) {
              setFilter(e.target.value.slice(1)); setOpen(true); setSelectedIdx(0);
            } else { setOpen(false); }
          }}
          onFocus={() => { if (showSuggestion) setOpen(true); }}
          onKeyDown={handleKeyDown}
          sx={{ "& .MuiOutlinedInput-root": { fontFamily: '"JetBrains Mono", monospace', fontSize: 12, padding: "2px 6px" } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {showSuggestion ? <SearchRounded sx={{ fontSize: 14, color: "text.secondary" }} /> : <TerminalRounded sx={{ fontSize: 14, color: "text.secondary" }} />}
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton sx={{ p: 0.25 }} onClick={() => handleSend()} disabled={!input}>
                  <SendRounded sx={{ fontSize: 14 }} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
          {snippets.slice(0, 3).map((s) => (
            <Tooltip key={s.id} title={s.command} placement="top">
              <Chip label={s.name} size="small" onClick={() => handleSend(s.command)} icon={<CodeRounded sx={{ fontSize: 12 }} />} />
            </Tooltip>
          ))}
        </Box>

        <Popper
          open={open && filteredSnippets.length > 0}
          anchorEl={anchorRef.current}
          placement="top-start"
          sx={{ zIndex: 1300, width: anchorRef.current?.clientWidth || 600 }}
        >
          <Paper elevation={8} sx={{ maxHeight: 280, overflow: "auto", border: `1px solid ${preset.divider}` }}>
            <Box sx={{ px: 1.5, py: 0.5, borderBottom: `1px solid ${preset.divider}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
                {filteredSnippets.length} snippet(s) · ↑↓ navigate · Ctrl+↵ run
              </Typography>
            </Box>
            {categories.map((cat) => {
              const catSnippets = filteredSnippets.filter((s) => s.category === cat);
              return (
                <Box key={cat}>
                  <Typography variant="caption" sx={{ display: "block", px: 1.5, py: 0.25, color: "text.secondary", fontWeight: 600, fontSize: 9.5, textTransform: "uppercase" }}>
                    {cat}
                  </Typography>
                  <List dense disablePadding>
                    {catSnippets.map((snip) => {
                      const idx = filteredSnippets.indexOf(snip);
                      return (
                        <ListItemButton key={snip.id} selected={idx === selectedIdx} onClick={() => handleSend(snip.command)} sx={{ py: 0.25 }}>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <BoltRounded sx={{ fontSize: 14 }} color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={snip.name}
                            secondary={snip.command}
                            primaryTypographyProps={{ fontSize: 12, fontWeight: 500 }}
                            secondaryTypographyProps={{ fontSize: 10.5, fontFamily: "monospace", color: "text.secondary" }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                  <Divider />
                </Box>
              );
            })}
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}
