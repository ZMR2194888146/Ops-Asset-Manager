import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  IconButton,
  Tooltip,
  Chip,
  Popper,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  Divider,
  Stack,
  CircularProgress,
} from "@mui/material";
import {
  BoltRounded,
  SendRounded,
  AutoAwesomeRounded,
  HistoryRounded,
  ExpandMoreRounded,
  TerminalRounded,
  FlagRounded,
  SubdirectoryArrowRightRounded,
  CloudRounded,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../stores/store";
import { getThemePreset } from "../theme/presets";
import { getCompletions, applyCompletion, type CompletionItem } from "../utils/completion";

interface RichInputBarProps {
  sessionId: string;
}

const KIND_ICONS: Record<CompletionItem["kind"], React.ReactNode> = {
  command: <TerminalRounded sx={{ fontSize: 14 }} />,
  subcommand: <SubdirectoryArrowRightRounded sx={{ fontSize: 14 }} />,
  flag: <FlagRounded sx={{ fontSize: 14 }} />,
  snippet: <BoltRounded sx={{ fontSize: 14 }} />,
  path: <CloudRounded sx={{ fontSize: 14 }} />,
};

const KIND_COLORS: Record<CompletionItem["kind"], string> = {
  command: "primary.main",
  subcommand: "secondary.main",
  flag: "warning.main",
  snippet: "success.main",
  path: "info.main",
};

// Simple shell syntax highlighter
function highlightCommand(cmd: string, preset: ReturnType<typeof getThemePreset>): React.ReactNode {
  if (!cmd) return null;
  const parts: React.ReactNode[] = [];
  const tokens: { text: string; type: "cmd" | "arg" | "flag" | "pipe" | "string" | "redirect" }[] = [];
  let i = 0;
  while (i < cmd.length) {
    if (cmd[i] === " ") { tokens.push({ text: " ", type: "arg" }); i++; continue; }
    if (cmd[i] === '"' || cmd[i] === "'") {
      const quote = cmd[i]; let end = i + 1;
      while (end < cmd.length && cmd[end] !== quote) end++;
      tokens.push({ text: cmd.slice(i, end + 1), type: "string" }); i = end + 1; continue;
    }
    let end = i;
    while (end < cmd.length && cmd[end] !== " ") end++;
    const word = cmd.slice(i, end);
    if (word === "|" || word === "||" || word === "&&") tokens.push({ text: word, type: "pipe" });
    else if (word === ">" || word === ">>" || word === "<" || word === "2>") tokens.push({ text: word, type: "redirect" });
    else if (word.startsWith("-") || word.startsWith("--")) tokens.push({ text: word, type: "flag" });
    else if (tokens.filter((t) => t.type !== "arg").length === 0) tokens.push({ text: word, type: "cmd" });
    else tokens.push({ text: word, type: "arg" });
    i = end;
  }
  const colors = {
    cmd: preset.primary, arg: preset.text.primary, flag: preset.terminal.yellow,
    pipe: preset.terminal.magenta, string: preset.success, redirect: preset.terminal.cyan,
  };
  tokens.forEach((tok, idx) => {
    if (tok.text === " ") { parts.push(<span key={idx}> </span>); }
    else { parts.push(<span key={idx} style={{ color: colors[tok.type], fontWeight: tok.type === "cmd" ? 600 : 400 }}>{tok.text}</span>); }
  });
  return parts;
}

export function RichInputBar({ sessionId }: RichInputBarProps) {
  const snippets = useStore((s) => s.snippets);
  const themeId = useStore((s) => s.settings.themeId);
  const preset = getThemePreset(themeId);
  const ai = useStore((s) => s.ai);

  const [input, setInput] = useState("");
  const [multiline, setMultiline] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [caretPos, setCaretPos] = useState(0);
  const [selectedCompletion, setSelectedCompletion] = useState(0);

  // Completion state
  const completions = useMemo(() => {
    if (!input || isAiMode) return [];
    return getCompletions(input, caretPos, snippets);
  }, [input, caretPos, snippets, isAiMode]);

  const showCompletions = completions.length > 0 && !showHistory;

  // Reset selection when completions change
  useEffect(() => { setSelectedCompletion(0); }, [completions]);

  // Track caret position
  const updateCaret = useCallback(() => {
    const el = inputRef.current;
    if (el) setCaretPos(el.selectionStart ?? el.value.length);
  }, []);

  useEffect(() => {
    setIsAiMode(input.startsWith(">") && !input.startsWith("/"));
  }, [input]);

  const sendCommand = (cmd: string) => {
    if (!cmd.trim()) return;
    invoke("ssh_write", { sessionId, data: cmd + "\n" }).catch(() => {});
    setHistory((h) => [cmd, ...h.filter((c) => c !== cmd)].slice(0, 100));
    setInput("");
    setHistoryIdx(-1);
    setShowHistory(false);
    setCaretPos(0);
  };

  const acceptCompletion = useCallback(() => {
    if (!showCompletions || completions.length === 0) return;
    const item = completions[selectedCompletion];
    if (!item) return;
    const { input: newInput, caret: newCaret } = applyCompletion(input, caretPos, item);
    setInput(newInput);
    setCaretPos(newCaret);
    // Restore focus and caret
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
      }
    });
  }, [showCompletions, completions, selectedCompletion, input, caretPos]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab: accept completion (Warp-style)
    if (e.key === "Tab" && showCompletions) {
      e.preventDefault();
      acceptCompletion();
      return;
    }

    // Arrow navigation for completions
    if (showCompletions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCompletion((i) => Math.min(i + 1, completions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCompletion((i) => Math.max(i - 1, 0));
        return;
      }
    }

    // Enter: send command or call AI
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isAiMode) {
        callAi();
      } else {
        sendCommand(input);
      }
      return;
    }

    // Arrow Up/Down: history navigation (when completions not shown)
    if (!multiline && !showCompletions) {
      if (e.key === "ArrowUp" && !showHistory) {
        e.preventDefault();
        if (history.length > 0) { setShowHistory(true); setHistoryIdx(0); }
        return;
      }
      if (e.key === "ArrowDown" && showHistory) {
        e.preventDefault();
        if (historyIdx <= 0) { setShowHistory(false); setHistoryIdx(-1); setInput(""); }
        else setHistoryIdx((i) => i - 1);
        return;
      }
    }

    // Esc: dismiss popups
    if (e.key === "Escape") {
      setShowHistory(false);
      return;
    }

    // Ctrl+L: clear
    if (e.ctrlKey && e.key === "l") { e.preventDefault(); sendCommand("clear"); return; }
    // Ctrl+C: interrupt
    if (e.ctrlKey && e.key === "c" && input === "") { e.preventDefault(); invoke("ssh_write", { sessionId, data: "\x03" }).catch(() => {}); return; }
  };

  // Apply history selection
  useEffect(() => {
    if (showHistory && historyIdx >= 0 && historyIdx < history.length) {
      setInput(history[historyIdx]);
    }
  }, [historyIdx, showHistory, history]);

  // Call AI to generate a command from natural language
  const callAi = async () => {
    const query = input.slice(1).trim();
    if (!query) return;
    setAiLoading(true);
    setAiResult("");
    try {
      const result = await invoke<string>("ai_complete", {
        req: {
          provider: ai.provider,
          api_key: ai.apiKey,
          base_url: ai.baseUrl,
          model: ai.model,
          prompt: query,
        },
      });
      setAiResult(result);
    } catch (e) {
      // Fall back to local pattern matching if AI fails
      const fallback = localPatternMatch(query);
      if (fallback) {
        setAiResult(fallback);
      } else {
        setAiResult(`✗ ${e}`);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const localPatternMatch = (q: string): string | null => {
    const ql = q.toLowerCase();
    const mappings: { match: string[]; cmd: string }[] = [
      { match: ["disk", "space", "storage"], cmd: "df -h" },
      { match: ["memory", "ram", "mem"], cmd: "free -h" },
      { match: ["process", "top", "cpu"], cmd: "ps aux --sort=-%cpu | head -20" },
      { match: ["port", "listen", "network"], cmd: "ss -tlnp" },
      { match: ["docker", "container"], cmd: "docker ps -a" },
      { match: ["log", "nginx", "error"], cmd: "tail -f /var/log/nginx/error.log" },
      { match: ["user", "who", "logged"], cmd: "who" },
      { match: ["ip", "address"], cmd: "ip addr" },
      { match: ["uptime", "load"], cmd: "uptime" },
      { match: ["git", "status"], cmd: "git status" },
    ];
    for (const m of mappings) {
      if (m.match.some((kw) => ql.includes(kw))) return m.cmd;
    }
    return null;
  };

  return (
    <Box ref={containerRef} sx={{ borderTop: `1px solid ${preset.divider}`, background: preset.background.default, flexShrink: 0, position: "relative" }}>
      {/* AI Result bar */}
      {/* AI loading bar */}
      {isAiMode && aiLoading && (
        <Box sx={{ px: 1.5, py: 0.5, bgcolor: `${preset.primary}10`, borderBottom: `1px solid ${preset.divider}`, display: "flex", alignItems: "center", gap: 0.5 }}>
          <CircularProgress size={13} sx={{ color: preset.primary }} />
          <Typography sx={{ fontSize: 12, color: preset.text.secondary, flex: 1 }}>Asking AI ({ai.provider}/{ai.model})...</Typography>
        </Box>
      )}

      {/* AI result bar */}
      {isAiMode && aiResult && !aiLoading && (
        <Box sx={{ px: 1.5, py: 0.5, bgcolor: `${preset.primary}10`, borderBottom: `1px solid ${preset.divider}`, display: "flex", alignItems: "center", gap: 0.5 }}>
          <AutoAwesomeRounded sx={{ fontSize: 13, color: preset.primary }} />
          <Typography sx={{ fontFamily: "monospace", fontSize: 12, color: preset.text.primary, flex: 1 }}>{aiResult}</Typography>
          {!aiResult.startsWith("✗") && (
            <Chip label="Run" size="small" color="primary" onClick={() => { sendCommand(aiResult); setAiResult(""); }} sx={{ height: 18, fontSize: 10 }} />
          )}
          <Chip label={aiResult.startsWith("✗") ? "Retry" : "Edit"} size="small" onClick={() => { setInput(aiResult.startsWith("✗") ? ">" : aiResult); setAiResult(""); }} sx={{ height: 18, fontSize: 10 }} />
          <Chip label="×" size="small" onClick={() => setAiResult("")} sx={{ height: 18, fontSize: 10 }} />
        </Box>
      )}

      {/* Completion popup — Warp style */}
      {showCompletions && (
        <Popper open={showCompletions} anchorEl={containerRef.current} placement="top-start" sx={{ zIndex: 1300, width: containerRef.current?.clientWidth || 600 }}>
          <Paper elevation={8} sx={{ maxHeight: 300, overflow: "auto", border: `1px solid ${preset.divider}` }}>
            <Box sx={{ px: 1.5, py: 0.5, borderBottom: `1px solid ${preset.divider}`, display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="caption" sx={{ fontSize: 10, color: preset.text.secondary, fontWeight: 600 }}>
                {completions[0]?.kind === "command" ? "Commands" :
                 completions[0]?.kind === "flag" ? "Flags" :
                 completions[0]?.kind === "subcommand" ? "Subcommands" :
                 completions[0]?.kind === "snippet" ? "Snippets" : "Suggestions"}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 9, color: preset.text.secondary, opacity: 0.7 }}>
                Tab ↹ accept · ↑↓ navigate
              </Typography>
            </Box>
            <List dense disablePadding>
              {completions.map((item, idx) => (
                <ListItemButton
                  key={`${item.label}-${idx}`}
                  selected={idx === selectedCompletion}
                  onClick={() => {
                    const { input: newInput, caret: newCaret } = applyCompletion(input, caretPos, item);
                    setInput(newInput);
                    setCaretPos(newCaret);
                    requestAnimationFrame(() => {
                      const el = inputRef.current;
                      if (el) { el.focus(); el.setSelectionRange(newCaret, newCaret); }
                    });
                  }}
                  sx={{ py: 0.25 }}
                >
                  <ListItemIcon sx={{ minWidth: 28, color: KIND_COLORS[item.kind] }}>
                    {KIND_ICONS[item.kind]}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Typography component="span" sx={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>
                          {item.label}
                        </Typography>
                        {item.detail && (
                          <Typography component="span" sx={{ fontSize: 10, color: preset.text.secondary }}>
                            {item.detail}
                          </Typography>
                        )}
                        {item.category && (
                          <Chip label={item.category} size="small" sx={{ height: 14, fontSize: 8, opacity: 0.6 }} />
                        )}
                      </Box>
                    }
                    secondary={item.description}
                    secondaryTypographyProps={{ fontSize: 10, color: preset.text.secondary }}
                  />
                  {idx === selectedCompletion && (
                    <Chip label="Tab" size="small" sx={{ height: 16, fontSize: 9, bgcolor: preset.primary, color: "#fff" }} />
                  )}
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Popper>
      )}

      {/* History popup */}
      {showHistory && (
        <Popper open={showHistory} anchorEl={containerRef.current} placement="top-start" sx={{ zIndex: 1300, width: containerRef.current?.clientWidth || 600 }}>
          <Paper elevation={8} sx={{ maxHeight: 240, overflow: "auto", border: `1px solid ${preset.divider}` }}>
            <Box sx={{ px: 1.5, py: 0.5, borderBottom: `1px solid ${preset.divider}`, display: "flex", alignItems: "center", gap: 0.5 }}>
              <HistoryRounded sx={{ fontSize: 13, color: preset.text.secondary }} />
              <Typography variant="caption" sx={{ fontSize: 10, color: preset.text.secondary }}>History · ↑↓ navigate · Enter select</Typography>
            </Box>
            <List dense disablePadding>
              {history.map((cmd, idx) => (
                <ListItemButton key={idx} selected={idx === historyIdx}
                  onClick={() => { setInput(cmd); setShowHistory(false); setHistoryIdx(-1); inputRef.current?.focus(); }}
                  sx={{ py: 0.25 }}>
                  <ListItemText primary={cmd} primaryTypographyProps={{ fontFamily: "monospace", fontSize: 11.5 }} />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Popper>
      )}

      {/* Input area */}
      <Stack direction="row" spacing={0.5} alignItems="flex-end" sx={{ px: 1, py: 0.5 }}>
        {/* Prefix indicator */}
        <Box sx={{ pb: 0.25, flexShrink: 0 }}>
          {isAiMode ? (
            <AutoAwesomeRounded sx={{ fontSize: 16, color: preset.primary }} />
          ) : (
            <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: preset.success, fontWeight: 700, lineHeight: "20px" }}>
              $
            </Typography>
          )}
        </Box>

        {/* Syntax-highlighted overlay + transparent textarea */}
        <Box sx={{ flex: 1, position: "relative", height: multiline ? 80 : 22, flexShrink: 0 }}>
          {/* Highlight layer */}
          <Box sx={{
            position: "absolute", inset: 0, pointerEvents: "none",
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: 13, lineHeight: "20px",
            whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "hidden",
          }}>
            {highlightCommand(input, preset) || (
              <span style={{ color: preset.text.secondary, opacity: 0.4 }}>
                {isAiMode ? "Describe what you want to do..." : "Type a command · Tab for completions · ↑ for history · > for AI..."}
              </span>
            )}
          </Box>
          {/* Actual textarea */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); updateCaret(); }}
            onKeyDown={handleKeyDown}
            onKeyUp={updateCaret}
            onClick={updateCaret}
            rows={multiline ? 4 : 1}
            style={{
              position: "absolute", inset: 0, width: "100%",
              background: "transparent", border: "none", outline: "none", resize: "none",
              color: "transparent", caretColor: preset.primary,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontSize: 13, lineHeight: "20px", padding: 0, cursor: "text",
            }}
          />
        </Box>

        {/* Action buttons */}
        <Stack direction="row" spacing={0.25} sx={{ pb: 0.25, flexShrink: 0 }}>
          <Tooltip title={multiline ? "Single line" : "Multi-line"}>
            <IconButton size="small" onClick={() => setMultiline(!multiline)} sx={{ p: 0.25, color: multiline ? preset.primary : preset.text.secondary }}>
              <ExpandMoreRounded sx={{ fontSize: 16, transform: multiline ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </IconButton>
          </Tooltip>
          {isAiMode && (
            <Tooltip title="Ask AI">
              <span>
                <IconButton size="small" onClick={callAi} disabled={aiLoading || !input.slice(1).trim()} sx={{ p: 0.25, color: preset.primary }}>
                  {aiLoading ? <CircularProgress size={14} /> : <AutoAwesomeRounded sx={{ fontSize: 16 }} />}
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title={isAiMode ? "Ask AI (Enter)" : "Send (Enter)"}>
            <span>
              <IconButton
                size="small"
                onClick={() => isAiMode ? callAi() : sendCommand(input)}
                disabled={!input.trim() || (isAiMode && aiLoading)}
                sx={{ p: 0.25, color: preset.primary }}
              >
                <SendRounded sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Status line */}
      <Box sx={{ px: 1.5, pb: 0.25, display: "flex", gap: 1, alignItems: "center" }}>
        <Typography variant="caption" sx={{ fontSize: 9, color: preset.text.secondary }}>
          {multiline ? "Multi-line · Enter=Send · Shift+Enter=Newline" : "Enter=Send · Tab=Complete · ↑=History · >=AI"}
        </Typography>
      </Box>
    </Box>
  );
}
