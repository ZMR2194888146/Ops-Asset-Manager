# 运维人员资产管理工具 (Ops Asset Manager)

> 基于 Tauri v2 + React 18 + Rust 构建的桌面应用，为运维人员提供统一的 SSH 服务器、MinIO/S3 对象存储资产管理，以及集成 AI 辅助的终端操作体验。

## 功能概览

### 🖥️ 资产管理
- **SSH 服务器** — 统一管理所有服务器连接，支持密码 / 密钥认证、分组、标签、快速搜索
- **MinIO / S3 存储** — 管理 S3 兼容的对象存储连接，内置 Bucket 浏览器（上传、下载、删除、创建）
- **连接测试** — 创建资产时可一键测试连接是否可用
- **分组与搜索** — 按分组展示资产卡片，支持名称 / 主机 / 标签模糊搜索

### ⌨️ 终端
- **多标签终端** — 基于 xterm.js，支持多会话同时连接，断线自动重连
- **SFTP 文件浏览** — 终端侧边栏直接浏览远程文件系统（读写、上传、下载、新建目录）
- **服务器监控** — 实时查看 CPU、内存、磁盘、网络、负载等指标
- **端口转发** — 可视化端口转发管理，一键启停
- **命令片段** — 保存常用命令片段，快速执行

### 🤖 AI 辅助
- **自然语言生成命令** — 在终端输入 `>` 描述需求，AI 自动生成对应 shell 命令
- **多 Provider 支持** — OpenAI / Anthropic / Ollama / 自定义端点
- **本地降级** — AI 不可用时自动降级为本地模式匹配

### 🎨 命令补全 (Warp 风格)
- **上下文感知补全** — 根据输入位置自动补全命令名、子命令、参数标志
- **50+ 命令知识库** — 内置 docker、kubectl、git、systemctl、apt 等常用命令的子命令和标志
- **Tab 接受补全** — 选中建议后按 Tab 一键插入
- **语法高亮** — 命令、参数、标志、管道符、字符串实时着色

### 📁 配置持久化
- **默认存储** — 配置文件默认保存在 `~/.new-rsm/config.json`
- **自定义路径** — 可在设置中指定任意配置文件路径，路径记录在 `~/.new-rsm/meta.json`
- **自动保存** — 资产变更后自动写入配置文件（防抖 500ms）
- **启动加载** — 应用启动时从配置文件恢复全部资产
- **导入导出** — 支持 JSON 格式全量导出和 OpenSSH config 格式导出

### 🎨 主题
内置 9 套主题，UI 与终端同步切换：

| 主题 | 模式 |
|------|------|
| GitHub Dark | 暗色 |
| Dracula | 暗色 |
| One Dark | 暗色 |
| Monokai | 暗色 |
| Nord | 暗色 |
| Tokyo Night | 暗色 |
| Catppuccin Mocha | 暗色 |
| Light Clean | 亮色 |
| Solarized Light | 亮色 |

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Tauri v2 |
| 前端 | React 18 · TypeScript 5 · Vite 5 |
| UI 库 | MUI 6 (Material UI) · Emotion |
| 状态管理 | Zustand 4 (persist 中间件) |
| 终端 | xterm.js 5.5 (addon-fit, addon-web-links) |
| 后端 | Rust 2021 Edition |
| SSH | russh 0.46 · russh-sftp 2.3 |
| S3/MinIO | reqwest + 手动 AWS SigV4 签名 |
| AI | reqwest + OpenAI/Anthropic/Ollama Chat Completions API |
| XML 解析 | quick-xml 0.36 |

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri v2 前置依赖](https://v2.tauri.app/start/prerequisites/)

### 开发模式

```bash
# 安装前端依赖
npm install

# 启动 Tauri 开发模式（同时启动 Vite + Rust 编译）
npm run tauri dev
```

### 构建发布

```bash
# 构建可分发的桌面应用
npm run tauri build
```

### 仅前端开发

```bash
npm run dev      # 启动 Vite 开发服务器 (端口 1420)
npm run build    # TypeScript 类型检查 + 生产构建
```

### 仅后端编译

```bash
cd src-tauri
cargo check      # 类型检查
cargo build      # 编译
```

## 项目结构

```
ops-asset-manager/
├── src/                          # 前端源码
│   ├── main.tsx                  # 入口 (ThemeProvider + CssBaseline)
│   ├── App.tsx                   # 根布局 (侧边栏 + 视图切换)
│   ├── components/
│   │   ├── Sidebar.tsx           # 侧边栏导航 + 快速连接 + 资产列表
│   │   ├── AssetManager.tsx      # 资产卡片网格 (SSH + MinIO 统一展示)
│   │   ├── ServerDialog.tsx      # SSH 服务器添加/编辑弹窗 (含连接测试)
│   │   ├── MinioDialog.tsx       # MinIO 连接添加/编辑弹窗 (含连接测试)
│   │   ├── MinioBrowser.tsx      # MinIO Bucket/对象浏览器
│   │   ├── TerminalView.tsx      # 多标签终端 (SFTP + 监控 + 端口转发)
│   │   ├── RichInputBar.tsx      # 命令输入栏 (Warp 风格补全 + AI)
│   │   ├── CommandPalette.tsx    # Ctrl+Shift+P 命令面板
│   │   ├── FileManager.tsx       # SFTP 远程文件管理器
│   │   ├── ServerStatsPanel.tsx  # 服务器资源监控面板
│   │   ├── SnippetsManager.tsx   # 命令片段管理
│   │   ├── SnippetBar.tsx        # 终端片段快速栏
│   │   └── SettingsView.tsx      # 设置 (主题/终端/AI/配置文件/导出)
│   ├── stores/
│   │   └── store.ts              # Zustand 全局状态 (持久化)
│   ├── types/
│   │   └── index.ts              # TypeScript 类型定义
│   ├── theme/
│   │   ├── theme.ts              # MUI 主题构建器
│   │   └── presets.ts            # 9 套主题预设
│   └── utils/
│       ├── id.ts                 # ID 生成器
│       ├── commandSpecs.ts       # 命令知识库 (50+ 命令规格)
│       └── completion.ts         # 上下文感知补全引擎
├── src-tauri/                    # Rust 后端源码
│   ├── src/
│   │   ├── main.rs               # 入口
│   │   ├── lib.rs                # Tauri 命令注册 + AI/SFTP/MinIO/配置命令
│   │   ├── ssh.rs                # SSH 会话管理 (russh)
│   │   └── minio.rs              # S3 操作 + SigV4 签名
│   ├── Cargo.toml                # Rust 依赖
│   ├── tauri.conf.json           # Tauri 配置 (窗口/打包/权限)
│   └── capabilities/
│       └── default.json          # Tauri v2 权限声明
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

## 配置文件

| 文件 | 说明 |
|------|------|
| `~/.new-rsm/meta.json` | 元数据 — 记录用户选择的配置文件路径 |
| `~/.new-rsm/config.json` | 默认配置文件 — 所有资产、片段、设置 |

配置文件格式 (JSON)：

```json
{
  "servers": [...],
  "minioAssets": [...],
  "snippets": [...],
  "portForwards": [...],
  "settings": {
    "defaultShell": "bash",
    "fontSize": 14,
    "scrollback": 5000,
    "themeId": "github-dark"
  },
  "ai": {
    "provider": "openai",
    "apiKey": "sk-...",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o-mini"
  }
}
```

## Tauri 命令 (Rust → Frontend)

| 分类 | 命令 | 说明 |
|------|------|------|
| SSH | `ssh_connect` `ssh_test` `ssh_write` `ssh_resize` `ssh_disconnect` | 连接 / 测试 / 输入 / 调整大小 / 断开 |
| 端口转发 | `start_port_forward` `stop_port_forward` | 启动 / 停止 TCP 转发 |
| 监控 | `server_stats` | 采集 CPU/内存/磁盘/网络/负载 |
| SFTP | `sftp_init` `sftp_list` `sftp_read_file` `sftp_write_file` `sftp_mkdir` `sftp_remove` `sftp_rename` `sftp_realpath` | 远程文件操作 |
| MinIO | `minio_list_buckets` `minio_list_objects` `minio_create_bucket` `minio_delete_bucket` `minio_upload_object` `minio_download_object` `minio_delete_object` | S3 兼容存储操作 |
| 配置 | `read_config_file` `write_config_file` `get_config_path` `set_config_path` `export_config` | 配置读写 / 路径管理 / 导出 |
| AI | `ai_complete` | 调用 AI 生成命令 |

## AI 配置

在 **Settings → AI Configuration** 中配置：

| Provider | Base URL (默认) | 需要 API Key |
|----------|-----------------|-------------|
| OpenAI | `https://api.openai.com/v1` | ✅ |
| Anthropic | `https://api.anthropic.com` | ✅ |
| Ollama | `http://localhost:11434` | ❌ |
| Custom | 用户自定义 | 可选 |

终端中输入 `>` 进入 AI 模式，描述需求后按 Enter，AI 返回可直接执行的命令。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 发送命令 / AI 模式下调用 AI |
| `Tab` | 接受命令补全 |
| `↑` / `↓` | 历史记录导航 / 补全项导航 |
| `Shift + Enter` | 多行模式换行 |
| `Esc` | 关闭弹窗 |
| `Ctrl + Shift + P` | 打开命令面板 |
| `Ctrl + L` | 清屏 |
| `Ctrl + C` (空输入) | 发送中断信号 |

## License

Private
