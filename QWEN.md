# QWEN.md — RSM (Remote SSH Manager)

## Project Overview

RSM is a desktop SSH client application built with **Tauri v2** (Rust backend) and **React 18** (TypeScript frontend). It provides a unified interface for managing SSH connections, running interactive terminal sessions, browsing remote files via SFTP, forwarding ports, and monitoring server health — all within a single, themeable desktop app.

- **App name:** RSM — Remote SSH Manager
- **Identifier:** `com.rsm.ssh`
- **Version:** 0.1.0

## Tech Stack

| Layer       | Technologies                                                       |
| ----------- | ------------------------------------------------------------------ |
| Frontend    | React 18, TypeScript 5, Vite 5                                     |
| UI          | MUI 6 (`@mui/material`, `@mui/icons-material`), Emotion            |
| State       | Zustand 4 (with `persist` middleware → `localStorage` key `rsm-config`) |
| Terminal    | `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-web-links`     |
| Backend     | Rust 2021 edition, Tauri v2                                        |
| SSH         | `russh` 0.46, `russh-sftp` 2.3, `async-trait`, `tokio`             |
| Tauri Plugins | `tauri-plugin-dialog`, `tauri-plugin-fs`                         |

## Architecture

### Frontend (`src/`)

- `main.tsx` — Entry point; wraps `App` in MUI `ThemeProvider` + `CssBaseline`, resolves theme from store.
- `App.tsx` — Root layout: persistent `Sidebar` + switchable main views (`assets`, `terminal`, `snippets`, `settings`). All views are mounted simultaneously; visibility toggled via `display: none` for state preservation.
- `stores/store.ts` — Central Zustand store. Persists servers, snippets, port forwards, and settings. Manages terminal session lifecycle (open/close/setStatus). Includes `exportConfig()` (JSON) and `exportSshConfig()` (OpenSSH format) helpers.
- `types/index.ts` — Shared TypeScript interfaces (`ServerAsset`, `TerminalSession`, `Snippet`, `PortForward`, `FileEntry`, `AppConfig`, `ViewType`, `NavGroup`).
- `theme/` — `presets.ts` defines 9 `ThemePreset` objects (GitHub Dark, Dracula, One Dark, Monokai, Nord, Tokyo Night, Catppuccin Mocha, Light Clean, Solarized Light). Each preset includes both MUI palette colors and xterm terminal ANSI colors. `theme.ts` builds the MUI theme from a preset with dense, compact component overrides.
- `utils/id.ts` — `generateId(prefix)` helper for unique IDs.
- `components/` — Feature components (see below).

### Key Components

| Component           | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `Sidebar.tsx`       | Navigation + server list + add-server button                   |
| `TerminalView.tsx`  | Multi-tab terminal, port-forward panel, toggleable side panels |
| `TerminalPane`      | (inside TerminalView) xterm.js instance per session, reconnect logic |
| `FileManager.tsx`   | SFTP remote file browser (read/write/mkdir/remove/rename)     |
| `ServerStatsPanel.tsx` | Real-time server metrics (CPU, mem, disk, net, uptime)      |
| `SnippetsManager.tsx` | CRUD for reusable shell command snippets                     |
| `AssetManager.tsx`  | CRUD for SSH server connections                                |
| `ServerDialog.tsx`  | Modal form for adding/editing server configs                   |
| `SettingsView.tsx`  | Font size, scrollback, default shell, theme selection         |
| `CommandPalette.tsx`| Ctrl+Shift+P quick actions                                     |
| `RichInputBar.tsx`  | Snippet quick-launch bar on terminal view                     |

### Backend (`src-tauri/src/`)

- `main.rs` — Minimal entry point; calls `rsm_ssh_lib::run()`.
- `lib.rs` — Tauri command definitions and app setup. Registers all `#[tauri::command]` functions via `invoke_handler`. Manages `AppState` (a `SessionManager` behind `Arc<Mutex<>>`). Includes `server_stats` command that parses `/proc` output for CPU, memory, disk, network, load average, and uptime.
- `ssh.rs` — Core SSH session management using `russh`:
  - `SessionManager` — HashMap of session IDs → `SshSession` structs.
  - `SshSession` — Holds `client::Handle`, channel ID, resize channel, forward stop signals, optional SFTP session.
  - `connect()` — Establishes SSH connection, opens PTY (xterm-256color, 80×24), requests shell. Spawns async task that emits data via Tauri events (`ssh:data:{id}`) and close events (`ssh:closed:{id}`).
  - `write()` / `resize()` — Terminal I/O.
  - `start_forward()` / `stop_forward()` — TCP port forwarding via `channel_open_direct_tcpip`.
  - `exec()` — One-shot command execution (used by server stats).
  - SFTP methods — `sftp_init`, `sftp_list`, `sftp_read_file`, `sftp_write_file`, `sftp_mkdir`, `sftp_remove`, `sftp_rename`, `sftp_realpath`.
  - Auth supports password and private key (with optional passphrase). Server key verification always returns `Ok(true)`.

### Frontend ↔ Backend Communication

The frontend calls Rust via `invoke("command_name", { args })` and listens for events via `listen("event:name", callback)`:

| Tauri Command       | Parameters                                           |
| ------------------- | ---------------------------------------------------- |
| `ssh_connect`       | `sessionId`, `config` (SshConfig)                    |
| `ssh_write`         | `sessionId`, `data`                                  |
| `ssh_resize`        | `sessionId`, `cols`, `rows`                          |
| `ssh_disconnect`    | `sessionId`                                          |
| `start_port_forward`| `sessionId`, `forwardId`, `localHost`, `localPort`, `remoteHost`, `remotePort` |
| `stop_port_forward` | `sessionId`, `forwardId`                             |
| `server_stats`      | `sessionId`                                          |
| `sftp_init`         | `sessionId`                                          |
| `sftp_list`         | `sessionId`, `path`                                  |
| `sftp_read_file`    | `sessionId`, `path`                                  |
| `sftp_write_file`   | `sessionId`, `path`, `data` (Vec\<u8>)               |
| `sftp_mkdir`        | `sessionId`, `path`                                  |
| `sftp_remove`       | `sessionId`, `path`, `is_dir`                        |
| `sftp_rename`       | `sessionId`, `oldPath`, `newPath`                    |
| `sftp_realpath`     | `sessionId`, `path`                                  |
| `export_config`     | `data`, `format` ("ssh" or "json")                   |

**Events (Rust → Frontend):**
- `ssh:data:{sessionId}` — Terminal output (string)
- `ssh:closed:{sessionId}` — Connection closed (unit)

**Important:** Tauri commands use snake_case in Rust but are invoked with camelCase parameter names from the frontend (e.g., `session_id` in Rust → `sessionId` in TypeScript).

## Build & Development Commands

```bash
# Frontend dev server (Vite, port 1420)
npm run dev

# Type-check + build frontend
npm run build

# Preview production build
npm run preview

# Full Tauri desktop app (dev mode — launches both Vite and Rust)
npm run tauri dev

# Build distributable desktop app
npm run tauri build

# Run Tauri CLI directly
npm run tauri
```

### Rust-only (from `src-tauri/`)

```bash
cargo build          # Compile backend
cargo check          # Type-check without producing binary
cargo clippy         # Lints
```

## Conventions

### Frontend
- **Functional components only** — no class components.
- **Zustand selectors** for state access: `useStore((s) => s.field)` — avoids unnecessary re-renders.
- **MUI `sx` prop** for all styling — no separate CSS files. Dense, compact spacing (base spacing unit: 6px, border radius: 8px).
- **Theme presets** drive both MUI and xterm appearance — always source colors from the active `ThemePreset`, never hardcode.
- **No external CSS** — everything uses MUI's CSS-in-JS or xterm's API.
- **TypeScript strict mode** — all component props and store actions are fully typed.
- **IDs** generated via `generateId(prefix)` from `utils/id.ts`.
- Tauri command invocations use `invoke()` from `@tauri-apps/api/core`; events use `listen()` from `@tauri-apps/api/event`.

### Backend (Rust)
- All SSH state is behind `Arc<Mutex<SessionManager>>` managed by Tauri's `.manage()`.
- All Tauri commands are `async` and return `Result<T, String>` for error propagation.
- Errors are converted to human-readable strings (not Rust error types).
- `russh` 0.46 API patterns — see the `russh-tauri-ssh` skill for exact signatures and common pitfalls.

### Theming
- 9 built-in themes in `src/theme/presets.ts`.
- Default theme: `github-dark`.
- Each preset defines both UI palette and full 16-color xterm ANSI palette.
- Themes are switched at runtime via the settings store; `main.tsx` rebuilds the MUI theme reactively.

## File Structure

```
new-rsm/
├── src/
│   ├── main.tsx              # Entry point + theme provider
│   ├── App.tsx               # Root layout
│   ├── components/           # All React components
│   ├── stores/store.ts       # Zustand store (persisted)
│   ├── types/index.ts        # Shared TypeScript types
│   ├── theme/
│   │   ├── theme.ts          # MUI theme builder
│   │   └── presets.ts        # 9 theme presets (UI + terminal)
│   └── utils/id.ts           # ID generator
├── src-tauri/
│   ├── src/
│   │   ├── main.rs           # Entry point
│   │   ├── lib.rs            # Tauri commands + app setup
│   │   └── ssh.rs            # SSH/SFTP/forward session manager
│   ├── Cargo.toml            # Rust dependencies
│   ├── tauri.conf.json       # Tauri config (window, bundling)
│   └── capabilities/         # Tauri v2 permission config
├── package.json
├── vite.config.ts            # Port 1420, Tauri dev host support
├── tsconfig.json
└── index.html
```
