export interface ServerAsset {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key";
  password?: string;
  privateKeyPath?: string;
  privateKeyPassphrase?: string;
  group?: string;
  tags?: string[];
  description?: string;
  lastConnected?: string;
}

export interface TerminalSession {
  id: string;
  serverId: string;
  serverName: string;
  host: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  error?: string;
}

export interface Snippet {
  id: string;
  name: string;
  command: string;
  description?: string;
  category?: string;
}

export interface PortForward {
  id: string;
  name: string;
  sessionId: string;
  serverName: string;
  localHost: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  enabled: boolean;
}

export interface AiConfig {
  provider: "openai" | "anthropic" | "ollama" | "custom";
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AppConfig {
  servers: ServerAsset[];
  minioAssets: MinioAsset[];
  snippets: Snippet[];
  portForwards: PortForward[];
  settings: {
    defaultShell: string;
    fontSize: number;
    scrollback: number;
    themeId: string;
  };
  ai: AiConfig;
}

export type ViewType = "terminal" | "assets" | "snippets" | "settings";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink: boolean;
  size: number;
  modified: number | null;
  permissions: number | null;
}

export interface NavGroup {
  title: string;
  servers: ServerAsset[];
}

export interface MinioAsset {
  id: string;
  name: string;
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  region: string;
  useSSL: boolean;
  defaultBucket?: string;
  group?: string;
  tags?: string[];
  description?: string;
}

export interface S3Entry {
  name: string;
  key: string;
  size: number;
  lastModified: number | null;
  isDir: boolean;
}
