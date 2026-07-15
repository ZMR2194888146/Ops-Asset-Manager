import {
  COMMAND_SPECS,
  findCommandSpec,
  type CommandSpec,
} from "./commandSpecs";
import type { Snippet } from "../types";

export type CompletionKind =
  | "command"
  | "subcommand"
  | "flag"
  | "snippet"
  | "path";

export interface CompletionItem {
  label: string;
  detail?: string;
  description?: string;
  kind: CompletionKind;
  category?: string;
  /** Text to insert when accepted (defaults to label) */
  insertText?: string;
}

interface ParseResult {
  tokens: string[];
  cursorToken: string;
  cursorIndex: number; // which token index the cursor is in
  isFlag: boolean;
  commandName: string | null;
  isCommandPosition: boolean; // first word
}

/**
 * Parse input into tokens, respecting quotes — Warp-style.
 * Returns the token at cursor position and its context.
 */
export function parseInput(
  input: string,
  caret: number
): ParseResult {
  const tokens: string[] = [];
  let current = "";
  let i = 0;
  let inQuote: string | null = null;
  let tokenStarted = false;

  while (i < input.length) {
    const ch = input[i];

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
        current += ch;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        current += ch;
        tokenStarted = true;
      } else if (ch === " " || ch === "\t") {
        if (tokenStarted) {
          tokens.push(current);
          current = "";
          tokenStarted = false;
        }
      } else {
        current += ch;
        tokenStarted = true;
      }
    }
    i++;
  }
  // Last token (or in-progress token)
  if (tokenStarted || current) {
    tokens.push(current);
  }

  // Determine which token the caret is in
  // Recompute positions to find cursor token index
  let pos = 0;
  let cursorIndex = 0;
  let cursorToken = "";
  let foundCursor = false;

  // Re-walk to find caret position
  let walkIdx = 0;
  let walkCurrent = "";
  let walkInQuote: string | null = null;
  let walkTokenStarted = false;
  const tokenPositions: { start: number; end: number }[] = [];

  while (walkIdx <= input.length) {
    const ch = walkIdx < input.length ? input[walkIdx] : null;

    if (walkIdx === input.length) {
      if (walkTokenStarted || walkCurrent) {
        tokenPositions.push({ start: walkIdx - walkCurrent.length, end: walkIdx });
      }
      break;
    }

    if (walkInQuote) {
      if (ch === walkInQuote) {
        walkInQuote = null;
        walkCurrent += ch;
      } else {
        walkCurrent += ch;
      }
    } else {
      if (ch === '"' || ch === "'") {
        walkInQuote = ch;
        walkCurrent += ch;
        walkTokenStarted = true;
      } else if (ch === " " || ch === "\t") {
        if (walkTokenStarted) {
          tokenPositions.push({ start: walkIdx - walkCurrent.length, end: walkIdx });
          walkCurrent = "";
          walkTokenStarted = false;
        }
      } else {
        walkCurrent += ch;
        walkTokenStarted = true;
      }
    }
    walkIdx++;
  }

  // Find cursor token
  for (let t = 0; t < tokenPositions.length; t++) {
    if (caret >= tokenPositions[t].start && caret <= tokenPositions[t].end) {
      cursorIndex = t;
      cursorToken = tokens[t] || "";
      foundCursor = true;
      break;
    }
  }

  // If caret is in whitespace between tokens, cursor token is empty (new token)
  if (!foundCursor) {
    cursorIndex = tokens.length;
    cursorToken = "";
  }

  const isCommandPosition = cursorIndex === 0;
  const isFlag = cursorToken.startsWith("-");

  // Find the command name (first non-flag token, or after pipe/&&)
  let commandName: string | null = null;
  let afterPipe = 0;
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];
    if (tok === "|" || tok === "&&" || tok === "||" || tok === ";") {
      afterPipe = t + 1;
      continue;
    }
    if (tok.startsWith("-")) continue;
    if (t === afterPipe) {
      commandName = tok;
      break;
    }
    if (t === 0) {
      commandName = tok;
      break;
    }
  }

  return {
    tokens,
    cursorToken,
    cursorIndex,
    isFlag,
    commandName,
    isCommandPosition,
  };
}

/**
 * Get completions for the current input at cursor position.
 */
export function getCompletions(
  input: string,
  caret: number,
  snippets: Snippet[]
): CompletionItem[] {
  const { cursorToken, isFlag, commandName, isCommandPosition, cursorIndex } =
    parseInput(input, caret);

  const prefix = cursorToken.toLowerCase();
  const results: CompletionItem[] = [];

  // 1. Command position — suggest commands
  if (isCommandPosition) {
    // Also include snippets if prefix starts with /
    for (const spec of COMMAND_SPECS) {
      if (spec.name.startsWith(prefix) || prefix === "") {
        results.push({
          label: spec.name,
          description: spec.description,
          category: spec.category,
          kind: "command",
        });
      }
    }
    // Sort by relevance: exact prefix match first, then alphabetical
    results.sort((a, b) => {
      const ap = a.label.startsWith(cursorToken) ? 0 : 1;
      const bp = b.label.startsWith(cursorToken) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.label.localeCompare(b.label);
    });
    return results.slice(0, 12);
  }

  // 2. Flag position — suggest flags for current command
  if (isFlag && commandName) {
    const spec = findCommandSpec(commandName);
    if (spec?.flags) {
      for (const flag of spec.flags) {
        if (flag.name.startsWith(prefix) || prefix === "-") {
          results.push({
            label: flag.name,
            description: flag.description,
            kind: "flag",
            insertText: flag.name,
          });
        }
      }
    }
    // Common universal flags
    const universal = [
      { name: "--help", description: "Show help" },
      { name: "--version", description: "Show version" },
    ];
    for (const flag of universal) {
      if (flag.name.startsWith(prefix)) {
        results.push({
          label: flag.name,
          description: flag.description,
          kind: "flag",
        });
      }
    }
    return results.slice(0, 12);
  }

  // 3. Subcommand position — suggest subcommands for known commands
  if (commandName && cursorIndex >= 1) {
    const spec = findCommandSpec(commandName);

    // Check if cursor is at position right after command (subcommand position)
    const isSubcommandPosition =
      cursorIndex === 1 ||
      (cursorIndex === 2 && commandName === tokens_before_pipe(input, caret));

    if (spec?.subcommands && isSubcommandPosition) {
      for (const sub of spec.subcommands) {
        if (sub.name.startsWith(prefix) || prefix === "") {
          results.push({
            label: sub.name,
            detail: commandName,
            description: sub.description,
            kind: "subcommand",
            category: spec.category,
          });
        }
      }
      return results.slice(0, 12);
    }
  }

  // 4. Snippet suggestions (always available in non-command positions too)
  for (const snip of snippets) {
    if (
      snip.name.toLowerCase().includes(prefix) ||
      snip.command.toLowerCase().includes(prefix)
    ) {
      if (prefix.length > 0) {
        results.push({
          label: snip.name,
          detail: "snippet",
          description: snip.command,
          kind: "snippet",
          insertText: snip.command,
          category: snip.category,
        });
      }
    }
  }

  return results.slice(0, 8);
}

/** Helper: get the token just before the cursor's pipe segment */
function tokens_before_pipe(input: string, caret: number): string | null {
  const { tokens } = parseInput(input, caret);
  return tokens[0] || null;
}

/**
 * Apply a completion: replace the current token with the insertText.
 * Returns new input string and new caret position.
 */
export function applyCompletion(
  input: string,
  caret: number,
  item: CompletionItem
): { input: string; caret: number } {
  const insertText = item.insertText || item.label;
  const { cursorIndex } = parseInput(input, caret);

  // Split input into tokens with positions
  const tokens: { text: string; start: number; end: number }[] = [];
  let current = "";
  let start = -1;
  let inQuote: string | null = null;

  for (let i = 0; i <= input.length; i++) {
    const ch = i < input.length ? input[i] : null;

    if (i === input.length) {
      if (current || start >= 0) {
        tokens.push({ text: current, start: start >= 0 ? start : i, end: i });
      }
      break;
    }

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
        current += ch;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' || ch === "'") {
        if (!current) start = i;
        inQuote = ch;
        current += ch;
      } else if (ch === " " || ch === "\t") {
        if (current) {
          tokens.push({ text: current, start: start >= 0 ? start : i - current.length, end: i });
          current = "";
          start = -1;
        }
      } else {
        if (!current) start = i;
        current += ch;
      }
    }
  }

  // If cursor is beyond tokens (trailing space), append new token
  if (cursorIndex >= tokens.length) {
    const newInput = input + insertText + " ";
    return { input: newInput, caret: newInput.length };
  }

  // Replace the token at cursorIndex
  const target = tokens[cursorIndex];
  const before = input.slice(0, target.start);
  const after = input.slice(target.end);
  const newInput = before + insertText + " " + after;
  const newCaret = target.start + insertText.length + 1;
  return { input: newInput, caret: newCaret };
}
