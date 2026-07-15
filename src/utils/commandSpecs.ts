export interface CommandFlag {
  name: string;
  description: string;
}

export interface CommandSub {
  name: string;
  description: string;
}

export interface CommandSpec {
  name: string;
  description: string;
  category: string;
  subcommands?: CommandSub[];
  flags?: CommandFlag[];
}

export const COMMAND_SPECS: CommandSpec[] = [
  // --- Docker ---
  {
    name: "docker",
    description: "Container management",
    category: "Docker",
    subcommands: [
      { name: "ps", description: "List containers" },
      { name: "images", description: "List images" },
      { name: "run", description: "Create and start container" },
      { name: "exec", description: "Execute command in container" },
      { name: "stop", description: "Stop container" },
      { name: "start", description: "Start container" },
      { name: "restart", description: "Restart container" },
      { name: "rm", description: "Remove container" },
      { name: "rmi", description: "Remove image" },
      { name: "logs", description: "View container logs" },
      { name: "build", description: "Build image from Dockerfile" },
      { name: "compose", description: "Docker Compose" },
      { name: "network", description: "Manage networks" },
      { name: "volume", description: "Manage volumes" },
      { name: "stats", description: "Container resource stats" },
      { name: "inspect", description: "Inspect container/image" },
      { name: "pull", description: "Pull image from registry" },
      { name: "push", description: "Push image to registry" },
      { name: "tag", description: "Tag an image" },
    ],
    flags: [
      { name: "-d", description: "Run in background (detached)" },
      { name: "-it", description: "Interactive terminal" },
      { name: "--rm", description: "Remove container on exit" },
      { name: "-v", description: "Mount volume" },
      { name: "-p", description: "Publish port" },
      { name: "-e", description: "Set environment variable" },
      { name: "--name", description: "Container name" },
      { name: "-a", description: "Show all containers" },
      { name: "-f", description: "Follow log output" },
      { name: "--format", description: "Format output" },
    ],
  },
  {
    name: "docker-compose",
    description: "Multi-container orchestration",
    category: "Docker",
    subcommands: [
      { name: "up", description: "Start services" },
      { name: "down", description: "Stop and remove services" },
      { name: "start", description: "Start services" },
      { name: "stop", description: "Stop services" },
      { name: "restart", description: "Restart services" },
      { name: "build", description: "Build images" },
      { name: "logs", description: "View logs" },
      { name: "ps", description: "List containers" },
      { name: "exec", description: "Execute command" },
    ],
    flags: [
      { name: "-d", description: "Detached mode" },
      { name: "--build", description: "Rebuild images" },
      { name: "-f", description: "Follow logs" },
      { name: "--scale", description: "Scale service" },
    ],
  },

  // --- Kubernetes ---
  {
    name: "kubectl",
    description: "Kubernetes cluster management",
    category: "Kubernetes",
    subcommands: [
      { name: "get", description: "Show resources" },
      { name: "describe", description: "Show details of resource" },
      { name: "apply", description: "Apply configuration" },
      { name: "delete", description: "Delete resources" },
      { name: "create", description: "Create resources" },
      { name: "edit", description: "Edit resource" },
      { name: "logs", description: "View pod logs" },
      { name: "exec", description: "Execute command in pod" },
      { name: "port-forward", description: "Forward local port to pod" },
      { name: "scale", description: "Scale deployment" },
      { name: "rollout", description: "Manage rollout" },
      { name: "config", description: "Modify kubeconfig" },
      { name: "cluster-info", description: "Cluster info" },
      { name: "top", description: "Show resource usage" },
      { name: "namespace", description: "Namespace operations" },
    ],
    flags: [
      { name: "-n", description: "Namespace" },
      { name: "-A", description: "All namespaces" },
      { name: "-o", description: "Output format (json/yaml/wide)" },
      { name: "-f", description: "Filename or URL" },
      { name: "--watch", description: "Watch for changes" },
      { name: "--all-namespaces", description: "All namespaces" },
    ],
  },

  // --- Git ---
  {
    name: "git",
    description: "Version control",
    category: "Git",
    subcommands: [
      { name: "status", description: "Working tree status" },
      { name: "add", description: "Stage changes" },
      { name: "commit", description: "Commit changes" },
      { name: "push", description: "Push to remote" },
      { name: "pull", description: "Pull from remote" },
      { name: "clone", description: "Clone repository" },
      { name: "checkout", description: "Switch branch" },
      { name: "branch", description: "List/create branches" },
      { name: "merge", description: "Merge branches" },
      { name: "rebase", description: "Rebase commits" },
      { name: "log", description: "Commit history" },
      { name: "diff", description: "Show changes" },
      { name: "stash", description: "Stash changes" },
      { name: "fetch", description: "Fetch from remote" },
      { name: "reset", description: "Reset HEAD" },
      { name: "revert", description: "Revert commit" },
      { name: "tag", description: "Manage tags" },
      { name: "remote", description: "Manage remotes" },
      { name: "init", description: "Initialize repository" },
    ],
    flags: [
      { name: "--all", description: "All branches" },
      { name: "--force", description: "Force operation" },
      { name: "--hard", description: "Discard changes" },
      { name: "--soft", description: "Keep changes staged" },
      { name: "--global", description: "Global config" },
      { name: "--amend", description: "Modify last commit" },
      { name: "--oneline", description: "One line per commit" },
      { name: "--graph", description: "ASCII graph" },
    ],
  },

  // --- System ---
  {
    name: "systemctl",
    description: "Service management",
    category: "System",
    subcommands: [
      { name: "status", description: "Service status" },
      { name: "start", description: "Start service" },
      { name: "stop", description: "Stop service" },
      { name: "restart", description: "Restart service" },
      { name: "enable", description: "Enable service" },
      { name: "disable", description: "Disable service" },
      { name: "reload", description: "Reload config" },
      { name: "list-units", description: "List all units" },
      { name: "list-sockets", description: "List sockets" },
      { name: "daemon-reload", description: "Reload systemd" },
    ],
    flags: [
      { name: "--now", description: "Also start/stop immediately" },
      { name: "--all", description: "Show all units" },
      { name: "--failed", description: "Show failed units" },
      { name: "--type", description: "Filter by type" },
    ],
  },
  {
    name: "journalctl",
    description: "Query systemd journal",
    category: "System",
    subcommands: [
      { name: "-u", description: "Filter by unit" },
      { name: "-f", description: "Follow logs" },
    ],
    flags: [
      { name: "-f", description: "Follow" },
      { name: "-n", description: "Number of lines" },
      { name: "--since", description: "From time" },
      { name: "--until", description: "To time" },
      { name: "--no-pager", description: "Disable pager" },
      { name: "-p", description: "Priority filter" },
    ],
  },
  {
    name: "apt",
    description: "Package manager (Debian/Ubuntu)",
    category: "System",
    subcommands: [
      { name: "update", description: "Update package list" },
      { name: "upgrade", description: "Upgrade packages" },
      { name: "install", description: "Install package" },
      { name: "remove", description: "Remove package" },
      { name: "purge", description: "Remove with config" },
      { name: "search", description: "Search packages" },
      { name: "show", description: "Package details" },
      { name: "list", description: "List packages" },
      { name: "autoremove", description: "Remove unused deps" },
    ],
    flags: [
      { name: "-y", description: "Auto-confirm" },
      { name: "--fix-broken", description: "Fix broken deps" },
    ],
  },
  {
    name: "yum",
    description: "Package manager (RHEL/CentOS)",
    category: "System",
    subcommands: [
      { name: "install", description: "Install package" },
      { name: "remove", description: "Remove package" },
      { name: "update", description: "Update packages" },
      { name: "search", description: "Search packages" },
      { name: "list", description: "List packages" },
      { name: "info", description: "Package info" },
    ],
    flags: [
      { name: "-y", description: "Auto-confirm" },
    ],
  },
  {
    name: "top",
    description: "Process monitor",
    category: "System",
    flags: [
      { name: "-b", description: "Batch mode" },
      { name: "-n", description: "Iterations" },
      { name: "-p", description: "Specific PID" },
    ],
  },
  {
    name: "htop",
    description: "Interactive process viewer",
    category: "System",
  },
  {
    name: "uname",
    description: "System information",
    category: "System",
    flags: [
      { name: "-a", description: "All info" },
      { name: "-r", description: "Kernel release" },
      { name: "-m", description: "Machine hardware" },
    ],
  },
  {
    name: "df",
    description: "Disk space usage",
    category: "System",
    flags: [
      { name: "-h", description: "Human readable" },
      { name: "-i", description: "Inodes" },
      { name: "-T", description: "File system type" },
    ],
  },
  {
    name: "du",
    description: "Directory space usage",
    category: "System",
    flags: [
      { name: "-h", description: "Human readable" },
      { name: "-s", description: "Summary only" },
      { name: "-a", description: "All files" },
      { name: "--max-depth", description: "Max depth" },
    ],
  },
  {
    name: "free",
    description: "Memory usage",
    category: "System",
    flags: [
      { name: "-h", description: "Human readable" },
      { name: "-m", description: "MB" },
      { name: "-g", description: "GB" },
      { name: "-s", description: "Repeat every N seconds" },
    ],
  },
  {
    name: "uptime",
    description: "System uptime and load",
    category: "System",
  },
  {
    name: "who",
    description: "Logged in users",
    category: "System",
  },
  {
    name: "reboot",
    description: "Restart system",
    category: "System",
  },
  {
    name: "shutdown",
    description: "Shutdown system",
    category: "System",
    flags: [
      { name: "-h", description: "Halt" },
      { name: "-r", description: "Reboot" },
      { name: "now", description: "Immediately" },
    ],
  },

  // --- Network ---
  {
    name: "ss",
    description: "Socket statistics",
    category: "Network",
    flags: [
      { name: "-t", description: "TCP" },
      { name: "-u", description: "UDP" },
      { name: "-l", description: "Listening" },
      { name: "-n", description: "Numeric" },
      { name: "-p", description: "Process" },
      { name: "-a", description: "All" },
    ],
  },
  {
    name: "curl",
    description: "HTTP client",
    category: "Network",
    flags: [
      { name: "-X", description: "HTTP method" },
      { name: "-H", description: "Header" },
      { name: "-d", description: "Data body" },
      { name: "-o", description: "Output file" },
      { name: "-L", description: "Follow redirects" },
      { name: "-I", description: "Headers only" },
      { name: "-s", description: "Silent" },
      { name: "-k", description: "Insecure SSL" },
      { name: "--retry", description: "Retry count" },
    ],
  },
  {
    name: "wget",
    description: "Download files",
    category: "Network",
    flags: [
      { name: "-O", description: "Output file" },
      { name: "-c", description: "Continue download" },
      { name: "-q", description: "Quiet" },
      { name: "--recursive", description: "Recursive download" },
    ],
  },
  {
    name: "ping",
    description: "Network connectivity test",
    category: "Network",
    flags: [
      { name: "-c", description: "Count" },
      { name: "-i", description: "Interval" },
      { name: "-W", description: "Timeout" },
    ],
  },
  {
    name: "ssh",
    description: "Remote shell",
    category: "Network",
    flags: [
      { name: "-p", description: "Port" },
      { name: "-i", description: "Identity file" },
      { name: "-L", description: "Local forward" },
      { name: "-R", description: "Remote forward" },
      { name: "-D", description: "Dynamic forward" },
    ],
  },
  {
    name: "scp",
    description: "Secure copy",
    category: "Network",
    flags: [
      { name: "-P", description: "Port" },
      { name: "-r", description: "Recursive" },
      { name: "-i", description: "Identity file" },
    ],
  },
  {
    name: "ip",
    description: "Network interface config",
    category: "Network",
    subcommands: [
      { name: "addr", description: "Address management" },
      { name: "link", description: "Link management" },
      { name: "route", description: "Routing" },
      { name: "neigh", description: "Neighbor" },
    ],
  },
  {
    name: "netstat",
    description: "Network statistics",
    category: "Network",
    flags: [
      { name: "-t", description: "TCP" },
      { name: "-u", description: "UDP" },
      { name: "-l", description: "Listening" },
      { name: "-n", description: "Numeric" },
      { name: "-p", description: "Process" },
    ],
  },

  // --- Files ---
  {
    name: "ls",
    description: "List directory contents",
    category: "Files",
    flags: [
      { name: "-l", description: "Long format" },
      { name: "-a", description: "All files" },
      { name: "-h", description: "Human readable" },
      { name: "-R", description: "Recursive" },
      { name: "-t", description: "Sort by time" },
      { name: "-S", description: "Sort by size" },
    ],
  },
  {
    name: "cd",
    description: "Change directory",
    category: "Files",
  },
  {
    name: "cp",
    description: "Copy files",
    category: "Files",
    flags: [
      { name: "-r", description: "Recursive" },
      { name: "-f", description: "Force" },
      { name: "-i", description: "Interactive" },
      { name: "-v", description: "Verbose" },
      { name: "-p", description: "Preserve attributes" },
    ],
  },
  {
    name: "mv",
    description: "Move/rename files",
    category: "Files",
    flags: [
      { name: "-f", description: "Force" },
      { name: "-i", description: "Interactive" },
      { name: "-v", description: "Verbose" },
    ],
  },
  {
    name: "rm",
    description: "Remove files",
    category: "Files",
    flags: [
      { name: "-r", description: "Recursive" },
      { name: "-f", description: "Force" },
      { name: "-i", description: "Interactive" },
      { name: "-v", description: "Verbose" },
    ],
  },
  {
    name: "mkdir",
    description: "Create directories",
    category: "Files",
    flags: [
      { name: "-p", description: "Create parents" },
      { name: "-v", description: "Verbose" },
    ],
  },
  {
    name: "find",
    description: "Find files",
    category: "Files",
    flags: [
      { name: "-name", description: "Name pattern" },
      { name: "-type", description: "File type (f/d)" },
      { name: "-size", description: "File size" },
      { name: "-mtime", description: "Modified time" },
      { name: "-exec", description: "Execute command" },
      { name: "-delete", description: "Delete matches" },
    ],
  },
  {
    name: "grep",
    description: "Search text",
    category: "Files",
    flags: [
      { name: "-r", description: "Recursive" },
      { name: "-i", description: "Case insensitive" },
      { name: "-n", description: "Line numbers" },
      { name: "-v", description: "Invert match" },
      { name: "-l", description: "Filenames only" },
      { name: "-c", description: "Count" },
      { name: "-E", description: "Extended regex" },
      { name: "--color", description: "Highlight matches" },
    ],
  },
  {
    name: "chmod",
    description: "Change permissions",
    category: "Files",
  },
  {
    name: "chown",
    description: "Change ownership",
    category: "Files",
    flags: [
      { name: "-R", description: "Recursive" },
    ],
  },
  {
    name: "tar",
    description: "Archive utility",
    category: "Files",
    flags: [
      { name: "-czf", description: "Create gzip" },
      { name: "-xzf", description: "Extract gzip" },
      { name: "-cjf", description: "Create bzip2" },
      { name: "-xjf", description: "Extract bzip2" },
      { name: "-tf", description: "List contents" },
      { name: "-v", description: "Verbose" },
    ],
  },
  {
    name: "cat",
    description: "Print file contents",
    category: "Files",
    flags: [
      { name: "-n", description: "Line numbers" },
    ],
  },
  {
    name: "tail",
    description: "End of file",
    category: "Files",
    flags: [
      { name: "-f", description: "Follow" },
      { name: "-n", description: "Line count" },
    ],
  },
  {
    name: "head",
    description: "Start of file",
    category: "Files",
    flags: [
      { name: "-n", description: "Line count" },
    ],
  },
  {
    name: "less",
    description: "Pager",
    category: "Files",
  },
  {
    name: "vim",
    description: "Text editor",
    category: "Files",
  },
  {
    name: "nano",
    description: "Text editor",
    category: "Files",
  },

  // --- Process ---
  {
    name: "ps",
    description: "Process status",
    category: "Process",
    flags: [
      { name: "aux", description: "All processes" },
      { name: "-ef", description: "All processes (full)" },
      { name: "--sort", description: "Sort by column" },
    ],
  },
  {
    name: "kill",
    description: "Send signal to process",
    category: "Process",
    flags: [
      { name: "-9", description: "SIGKILL (force)" },
      { name: "-15", description: "SIGTERM (graceful)" },
      { name: "-HUP", description: "SIGHUP (reload)" },
    ],
  },
  {
    name: "killall",
    description: "Kill by process name",
    category: "Process",
    flags: [
      { name: "-9", description: "Force" },
    ],
  },
  {
    name: "nohup",
    description: "Run immune to hangups",
    category: "Process",
  },
  {
    name: "screen",
    description: "Terminal multiplexer",
    category: "Process",
    subcommands: [
      { name: "-ls", description: "List sessions" },
      { name: "-r", description: "Reattach session" },
      { name: "-S", description: "New named session" },
    ],
  },
  {
    name: "tmux",
    description: "Terminal multiplexer",
    category: "Process",
    subcommands: [
      { name: "new", description: "New session" },
      { name: "ls", description: "List sessions" },
      { name: "attach", description: "Attach session" },
      { name: "kill-session", description: "Kill session" },
    ],
  },

  // --- DevOps ---
  {
    name: "npm",
    description: "Node package manager",
    category: "DevOps",
    subcommands: [
      { name: "install", description: "Install packages" },
      { name: "run", description: "Run script" },
      { name: "start", description: "Start app" },
      { name: "test", description: "Run tests" },
      { name: "build", description: "Build project" },
      { name: "init", description: "Initialize project" },
      { name: "update", description: "Update packages" },
    ],
    flags: [
      { name: "-g", description: "Global" },
      { name: "--save-dev", description: "Dev dependency" },
      { name: "--force", description: "Force" },
    ],
  },
  {
    name: "pm2",
    description: "Process manager (Node)",
    category: "DevOps",
    subcommands: [
      { name: "start", description: "Start process" },
      { name: "stop", description: "Stop process" },
      { name: "restart", description: "Restart process" },
      { name: "list", description: "List processes" },
      { name: "logs", description: "View logs" },
      { name: "monit", description: "Monitor" },
      { name: "status", description: "Status" },
    ],
  },
  {
    name: "nginx",
    description: "Web server",
    category: "DevOps",
    subcommands: [
      { name: "-t", description: "Test config" },
      { name: "-s", description: "Signal (reload/stop)" },
    ],
  },
  {
    name: "redis-cli",
    description: "Redis client",
    category: "DevOps",
    subcommands: [
      { name: "ping", description: "Test connection" },
      { name: "get", description: "Get key" },
      { name: "set", description: "Set key" },
      { name: "keys", description: "List keys" },
      { name: "flushall", description: "Clear all keys" },
    ],
  },
  {
    name: "mysql",
    description: "MySQL client",
    category: "DevOps",
    flags: [
      { name: "-u", description: "Username" },
      { name: "-p", description: "Password prompt" },
      { name: "-h", description: "Host" },
      { name: "-P", description: "Port" },
    ],
  },
  {
    name: "psql",
    description: "PostgreSQL client",
    category: "DevOps",
    flags: [
      { name: "-U", description: "Username" },
      { name: "-h", description: "Host" },
      { name: "-p", description: "Port" },
      { name: "-d", description: "Database" },
    ],
  },
  {
    name: "supervisorctl",
    description: "Supervisor process control",
    category: "DevOps",
    subcommands: [
      { name: "status", description: "All status" },
      { name: "start", description: "Start process" },
      { name: "stop", description: "Stop process" },
      { name: "restart", description: "Restart process" },
      { name: "reread", description: "Reload config" },
      { name: "update", description: "Apply changes" },
    ],
  },
  {
    name: "crontab",
    description: "Cron job management",
    category: "DevOps",
    subcommands: [
      { name: "-l", description: "List jobs" },
      { name: "-e", description: "Edit jobs" },
      { name: "-r", description: "Remove all" },
    ],
  },
  {
    name: "env",
    description: "Environment variables",
    category: "DevOps",
    flags: [
      { name: "| sort", description: "Sorted output" },
    ],
  },
];

export const COMMAND_NAMES = COMMAND_SPECS.map((s) => s.name);

export function findCommandSpec(name: string): CommandSpec | undefined {
  return COMMAND_SPECS.find((s) => s.name === name);
}
