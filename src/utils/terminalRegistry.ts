import type { Terminal } from "@xterm/xterm";

const terminals = new Map<string, Terminal>();
// Maps original session id -> actual (current) session id after reconnection
const sessionIds = new Map<string, string>();

export function registerTerminal(sessionId: string, term: Terminal): void {
  terminals.set(sessionId, term);
  sessionIds.set(sessionId, sessionId);
}

// CWD tracking: session id -> remote working directory
const remoteCwds = new Map<string, string>();
const cwdListeners = new Map<string, Set<(cwd: string) => void>>();

export function unregisterTerminal(sessionId: string): void {
  terminals.delete(sessionId);
  sessionIds.delete(sessionId);
  remoteCwds.delete(sessionId);
  cwdListeners.delete(sessionId);
}

/** Set the remote CWD for a session and notify all listeners */
export function setRemoteCwd(sessionId: string, cwd: string): void {
  const prev = remoteCwds.get(sessionId);
  if (prev === cwd) return;
  remoteCwds.set(sessionId, cwd);
  cwdListeners.get(sessionId)?.forEach((fn) => fn(cwd));
}

export function getRemoteCwd(sessionId: string): string | undefined {
  return remoteCwds.get(sessionId);
}

/** Subscribe to CWD changes for a session; returns an unsubscribe function */
export function onRemoteCwdChange(sessionId: string, listener: (cwd: string) => void): () => void {
  if (!cwdListeners.has(sessionId)) cwdListeners.set(sessionId, new Set());
  cwdListeners.get(sessionId)!.add(listener);
  return () => { cwdListeners.get(sessionId)?.delete(listener); };
}

export function getTerminal(sessionId: string): Terminal | undefined {
  return terminals.get(sessionId);
}

/** Update the actual session id after reconnection (original -> new) */
export function updateActualSessionId(originalId: string, actualId: string): void {
  sessionIds.set(originalId, actualId);
}

/** Get the actual session id to use for SSH commands (may differ from original after reconnect) */
export function getActualSessionId(originalId: string): string {
  return sessionIds.get(originalId) ?? originalId;
}

/**
 * Write a Warp-style block separator to the terminal before a command.
 * This creates visual block boundaries between commands.
 */
export function writeBlockSeparator(
  term: Terminal,
  command: string,
  mode: "dark" | "light"
): void {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const dim = mode === "dark" ? "\x1b[2;90m" : "\x1b[2;38;5;245m";
  const accent = mode === "dark" ? "\x1b[38;2;91;127;255m" : "\x1b[38;5;69m";
  const green = "\x1b[1;32m";
  const reset = "\x1b[0m";
  const cmdColor = mode === "dark" ? "\x1b[1;97m" : "\x1b[1;30m";
  const arrow = mode === "dark" ? "\x1b[38;2;74;222;128m" : "\x1b[38;5;34m";

  const minLine = 50;
  const contentWidth = time.length + 3 + command.length + 4;
  const lineWidth = Math.max(minLine - contentWidth, 3);
  const line = "─".repeat(lineWidth);

  term.writeln("");
  term.writeln(`${dim}╭─${reset}${accent} ${time} ${reset}${dim}—${reset} ${green}$${reset} ${cmdColor}${command}${reset}`);
  term.writeln(`${dim}╰─${line}${reset} ${arrow}›${reset}`);
}
