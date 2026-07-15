import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import type {
  AppConfig,
  ServerAsset,
  MinioAsset,
  Snippet,
  PortForward,
  TerminalSession,
  ViewType,
  AiConfig,
} from "../types";

interface AppStore {
  view: ViewType;
  servers: ServerAsset[];
  minioAssets: MinioAsset[];
  snippets: Snippet[];
  portForwards: PortForward[];
  sessions: TerminalSession[];
  activeSessionId: string | null;
  activeMinioId: string | null;
  configFilePath: string | null;
  settings: {
    defaultShell: string;
    fontSize: number;
    scrollback: number;
    themeId: string;
  };
  ai: AiConfig;

  setView: (view: ViewType) => void;
  addServer: (server: ServerAsset) => void;
  updateServer: (id: string, updates: Partial<ServerAsset>) => void;
  deleteServer: (id: string) => void;
  addMinioAsset: (asset: MinioAsset) => void;
  updateMinioAsset: (id: string, updates: Partial<MinioAsset>) => void;
  deleteMinioAsset: (id: string) => void;
  setActiveMinioId: (id: string | null) => void;
  addSnippet: (snippet: Snippet) => void;
  updateSnippet: (id: string, updates: Partial<Snippet>) => void;
  deleteSnippet: (id: string) => void;
  addPortForward: (pf: PortForward) => void;
  updatePortForward: (id: string, updates: Partial<PortForward>) => void;
  deletePortForward: (id: string) => void;
  openSession: (server: ServerAsset) => void;
  closeSession: (id: string) => void;
  setSessionStatus: (
    id: string,
    status: TerminalSession["status"],
    error?: string
  ) => void;
  setActiveSession: (id: string | null) => void;
  updateSettings: (updates: Partial<AppStore["settings"]>) => void;
  updateAi: (updates: Partial<AiConfig>) => void;
  getServerById: (id: string) => ServerAsset | undefined;
  exportConfig: () => string;
  exportSshConfig: () => string;
  setConfigFilePath: (path: string | null) => void;
  loadConfigFromFile: () => Promise<void>;
  saveConfigToFile: () => Promise<void>;
}

const STORAGE_KEY = "rsm-config";

const defaultSnippets: Snippet[] = [
  {
    id: "snip-1",
    name: "Disk usage",
    command: "df -h",
    description: "Show disk space usage",
    category: "System",
  },
  {
    id: "snip-2",
    name: "Memory info",
    command: "free -h",
    description: "Show memory information",
    category: "System",
  },
  {
    id: "snip-3",
    name: "Top processes",
    command: "ps aux --sort=-%cpu | head -20",
    description: "Top 20 processes by CPU",
    category: "Process",
  },
  {
    id: "snip-4",
    name: "List ports",
    command: "ss -tlnp",
    description: "List listening TCP ports",
    category: "Network",
  },
  {
    id: "snip-5",
    name: "Docker containers",
    command: "docker ps -a",
    description: "List all Docker containers",
    category: "Docker",
  },
  {
    id: "snip-6",
    name: "System logs",
    command: "journalctl -u nginx -f --no-pager -n 50",
    description: "Tail nginx service logs",
    category: "Logs",
  },
];

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      view: "assets",
      servers: [],
      minioAssets: [],
      snippets: defaultSnippets,
      portForwards: [],
      sessions: [],
      activeSessionId: null,
      activeMinioId: null,
      configFilePath: null,
      settings: {
        defaultShell: "bash",
        fontSize: 14,
        scrollback: 5000,
        themeId: "github-dark",
      },
      ai: {
        provider: "openai",
        apiKey: "",
        baseUrl: "",
        model: "",
      },

      setView: (view) => set({ view }),

      addServer: (server) =>
        set((s) => ({ servers: [...s.servers, server] })),

      updateServer: (id, updates) =>
        set((s) => ({
          servers: s.servers.map((srv) =>
            srv.id === id ? { ...srv, ...updates } : srv
          ),
        })),

      deleteServer: (id) =>
        set((s) => ({
          servers: s.servers.filter((srv) => srv.id !== id),
          sessions: s.sessions.filter((sess) => sess.serverId !== id),
        })),

      addMinioAsset: (asset) =>
        set((s) => ({ minioAssets: [...s.minioAssets, asset] })),

      updateMinioAsset: (id, updates) =>
        set((s) => ({
          minioAssets: s.minioAssets.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),

      deleteMinioAsset: (id) =>
        set((s) => ({ minioAssets: s.minioAssets.filter((m) => m.id !== id) })),

      setActiveMinioId: (id) => set({ activeMinioId: id }),

      addSnippet: (snippet) =>
        set((s) => ({ snippets: [...s.snippets, snippet] })),

      updateSnippet: (id, updates) =>
        set((s) => ({
          snippets: s.snippets.map((snip) =>
            snip.id === id ? { ...snip, ...updates } : snip
          ),
        })),

      deleteSnippet: (id) =>
        set((s) => ({ snippets: s.snippets.filter((snip) => snip.id !== id) })),

      addPortForward: (pf) =>
        set((s) => ({ portForwards: [...s.portForwards, pf] })),

      updatePortForward: (id, updates) =>
        set((s) => ({
          portForwards: s.portForwards.map((pf) =>
            pf.id === id ? { ...pf, ...updates } : pf
          ),
        })),

      deletePortForward: (id) =>
        set((s) => ({
          portForwards: s.portForwards.filter((pf) => pf.id !== id),
        })),

      openSession: (server) => {
        const existing = get().sessions.find(
          (s) => s.serverId === server.id && s.status !== "disconnected"
        );
        if (existing) {
          set({ activeSessionId: existing.id, view: "terminal" });
          return;
        }
        const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const session: TerminalSession = {
          id: sessionId,
          serverId: server.id,
          serverName: server.name,
          host: server.host,
          status: "connecting",
        };
        set((s) => ({
          sessions: [...s.sessions, session],
          activeSessionId: sessionId,
          view: "terminal",
        }));
      },

      closeSession: (id) =>
        set((s) => {
          const sessions = s.sessions.filter((sess) => sess.id !== id);
          const activeSessionId =
            s.activeSessionId === id
              ? sessions.length > 0
                ? sessions[sessions.length - 1].id
                : null
              : s.activeSessionId;
          return { sessions, activeSessionId };
        }),

      setSessionStatus: (id, status, error) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id ? { ...sess, status, error } : sess
          ),
        })),

      setActiveSession: (id) => set({ activeSessionId: id }),

      updateSettings: (updates) =>
        set((s) => ({ settings: { ...s.settings, ...updates } })),

      updateAi: (updates) =>
        set((s) => ({ ai: { ...s.ai, ...updates } })),

      getServerById: (id) => get().servers.find((s) => s.id === id),

      exportConfig: () => {
        const state = get();
        const config: AppConfig = {
          servers: state.servers,
          minioAssets: state.minioAssets,
          snippets: state.snippets,
          portForwards: state.portForwards,
          settings: state.settings,
          ai: state.ai,
        };
        return JSON.stringify(config, null, 2);
      },

      exportSshConfig: () => {
        const servers = get().servers;
        let output = "# Generated by RSM - Remote SSH Manager\n\n";
        servers.forEach((s) => {
          output += `Host ${s.name}\n`;
          output += `    HostName ${s.host}\n`;
          output += `    Port ${s.port}\n`;
          output += `    User ${s.username}\n`;
          if (s.authMethod === "key" && s.privateKeyPath) {
            output += `    IdentityFile ${s.privateKeyPath}\n`;
          }
          if (s.description) {
            output += `    # ${s.description}\n`;
          }
          output += "\n";
        });
        return output;
      },

      setConfigFilePath: (path) => set({ configFilePath: path }),

      loadConfigFromFile: async () => {
        const filePath = get().configFilePath;
        if (!filePath) return;
        const content = await invoke<string>("read_config_file", { path: filePath });
        const config = JSON.parse(content) as AppConfig;
        set({
          servers: config.servers ?? [],
          minioAssets: config.minioAssets ?? [],
          snippets: config.snippets ?? defaultSnippets,
          portForwards: config.portForwards ?? [],
          settings: { ...get().settings, ...config.settings },
          ai: { ...get().ai, ...config.ai },
        });
      },

      saveConfigToFile: async () => {
        const filePath = get().configFilePath;
        if (!filePath) return;
        const config: AppConfig = {
          servers: get().servers,
          minioAssets: get().minioAssets,
          snippets: get().snippets,
          portForwards: get().portForwards,
          settings: get().settings,
          ai: get().ai,
        };
        await invoke("write_config_file", { path: filePath, data: JSON.stringify(config, null, 2) });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        servers: state.servers,
        minioAssets: state.minioAssets,
        snippets: state.snippets,
        portForwards: state.portForwards,
        settings: state.settings,
        ai: state.ai,
      }),
    }
  )
);
