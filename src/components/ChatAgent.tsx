import { useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Tooltip,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  SendRounded,
  AutoAwesomeRounded,
  DeleteOutlineRounded,
  TerminalRounded,
  PersonRounded,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../stores/store";
import { getThemePreset } from "../theme/presets";
import { getActualSessionId } from "../utils/terminalRegistry";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatAgentProps {
  sessionId: string;
}

export function ChatAgent({ sessionId }: ChatAgentProps) {
  const themeId = useStore((s) => s.settings.themeId);
  const preset = getThemePreset(themeId);
  const ai = useStore((s) => s.ai);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    const query = input.trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: Date.now(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

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

      // Strip markdown code fences if present
      const cleaned = result.replace(/^```\w*\n?/gm, "").replace(/```$/gm, "").trim();

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        content: cleaned,
        timestamp: Date.now(),
      };
      setMessages((m) => [...m, aiMsg]);
    } catch (e) {
      setMessages((m) => [...m, {
        id: `msg-${Date.now()}-err`,
        role: "assistant",
        content: `Error: ${e}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const runCommand = (cmd: string) => {
    const actualId = getActualSessionId(sessionIdRef.current);
    invoke("ssh_write", { sessionId: actualId, data: cmd + "\n" }).catch(() => {});
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <Box sx={{
        display: "flex", alignItems: "center",
        px: 1, py: 0.5,
        borderBottom: `1px solid ${preset.divider}`,
        flexShrink: 0,
      }}>
        <AutoAwesomeRounded sx={{ fontSize: 14, color: preset.primary, mr: 0.5 }} />
        <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: preset.primary, flex: 1 }}>
          AI Assistant
        </Typography>
        <Chip
          label={ai.model || "not configured"}
          size="small"
          sx={{ height: 16, fontSize: 9, maxWidth: 100 }}
        />
        {messages.length > 0 && (
          <Tooltip title="Clear chat">
            <IconButton
              sx={{ p: 0.25, ml: 0.25 }}
              onClick={() => setMessages([])}
            >
              <DeleteOutlineRounded sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Messages */}
      <Box ref={scrollRef} sx={{ flex: 1, overflow: "auto", px: 1, py: 0.5 }}>
        {messages.length === 0 ? (
          <Box sx={{ py: 2, textAlign: "center" }}>
            <AutoAwesomeRounded sx={{ fontSize: 28, color: preset.primary, opacity: 0.3, mb: 0.5 }} />
            <Typography variant="caption" sx={{ display: "block", fontSize: 10, color: preset.text.secondary }}>
              Ask me anything about Linux commands.
            </Typography>
            <Typography variant="caption" sx={{ display: "block", fontSize: 9, color: preset.text.secondary, mt: 0.25, opacity: 0.7 }}>
              e.g. "how to check disk space?"
            </Typography>
          </Box>
        ) : (
          messages.map((msg) => (
            <Box key={msg.id} sx={{ mb: 0.75 }}>
              {/* Role label */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, mb: 0.25 }}>
                {msg.role === "user" ? (
                  <PersonRounded sx={{ fontSize: 11, color: preset.text.secondary }} />
                ) : (
                  <AutoAwesomeRounded sx={{ fontSize: 11, color: preset.primary }} />
                )}
                <Typography sx={{ fontSize: 9, color: preset.text.secondary, fontWeight: 600 }}>
                  {msg.role === "user" ? "You" : "AI"}
                </Typography>
                <Typography sx={{ fontSize: 8, color: preset.text.secondary, opacity: 0.6, ml: "auto" }}>
                  {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
                </Typography>
              </Box>
              {/* Message bubble */}
              <Box sx={{
                ml: 1.5,
                px: 0.75, py: 0.4,
                borderRadius: 1,
                bgcolor: msg.role === "user"
                  ? `${preset.primary}12`
                  : preset.background.default,
                border: `1px solid ${preset.divider}`,
              }}>
                <Typography sx={{
                  fontSize: 11,
                  lineHeight: 1.5,
                  fontFamily: msg.role === "assistant" ? '"JetBrains Mono", "Fira Code", monospace' : "inherit",
                  color: msg.content.startsWith("Error:") ? preset.error : preset.text.primary,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {msg.content}
                </Typography>
                {/* Run button for assistant messages that look like commands */}
                {msg.role === "assistant" && !msg.content.startsWith("Error:") && (
                  <Box sx={{ mt: 0.25, display: "flex", gap: 0.5 }}>
                    <Chip
                      label="Run in terminal"
                      size="small"
                      icon={<TerminalRounded sx={{ fontSize: 12 }} />}
                      onClick={() => runCommand(msg.content)}
                      sx={{
                        height: 18, fontSize: 9,
                        cursor: "pointer",
                        "& .MuiChip-icon": { ml: 0.25 },
                      }}
                    />
                    <Chip
                      label="Copy"
                      size="small"
                      onClick={() => navigator.clipboard?.writeText(msg.content)}
                      sx={{ height: 18, fontSize: 9, cursor: "pointer" }}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          ))
        )}
        {loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.5 }}>
            <CircularProgress size={12} sx={{ color: preset.primary }} />
            <Typography sx={{ fontSize: 10, color: preset.text.secondary }}>
              Thinking... ({ai.provider}/{ai.model})
            </Typography>
          </Box>
        )}
      </Box>

      {/* Input */}
      <Box sx={{
        borderTop: `1px solid ${preset.divider}`,
        px: 0.75, py: 0.5,
        flexShrink: 0,
      }}>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI..."
            rows={1}
            style={{
              flex: 1,
              background: preset.background.default,
              border: `1px solid ${preset.divider}`,
              borderRadius: 6,
              outline: "none",
              resize: "none",
              color: preset.text.primary,
              fontFamily: "inherit",
              fontSize: 12,
              lineHeight: "18px",
              padding: "5px 8px",
              caretColor: preset.primary,
              maxHeight: 80,
            }}
          />
          <Tooltip title="Send (Enter)">
            <span>
              <IconButton
                size="small"
                onClick={handleSend}
                disabled={!input.trim() || loading}
                sx={{
                  p: 0.5,
                  color: preset.primary,
                  bgcolor: `${preset.primary}10`,
                  "&:hover": { bgcolor: `${preset.primary}20` },
                  "&.Mui-disabled": { color: preset.text.secondary },
                }}
              >
                <SendRounded sx={{ fontSize: 15 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <Typography sx={{ fontSize: 8, color: preset.text.secondary, opacity: 0.6, mt: 0.25, textAlign: "center" }}>
          Enter to send · Shift+Enter for newline
        </Typography>
      </Box>
    </Box>
  );
}
