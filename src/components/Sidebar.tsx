import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
} from "@mui/material";
import {
  Terminal as TerminalIcon,
  DnsRounded as ServerIcon,
  CodeRounded as SnippetIcon,
  SettingsRounded as SettingsIcon,
  AddRounded as AddIcon,
  PowerSettingsNewRounded as PowerIcon,
  CloudRounded as MinioIcon,
} from "@mui/icons-material";
import { useState } from "react";
import { useStore } from "../stores/store";
import { getThemePreset } from "../theme/presets";
import type { ViewType, ServerAsset, MinioAsset } from "../types";

const DRAWER_WIDTH = 208;

const NAV_ITEMS: { view: ViewType; label: string; icon: React.ReactNode }[] = [
  { view: "assets", label: "Assets", icon: <ServerIcon /> },
  { view: "terminal", label: "Terminals", icon: <TerminalIcon /> },
  { view: "snippets", label: "Snippets", icon: <SnippetIcon /> },
  { view: "settings", label: "Settings", icon: <SettingsIcon /> },
];

interface SidebarProps {
  onAddServer: () => void;
  onAddMinio: () => void;
}

export function Sidebar({ onAddServer, onAddMinio }: SidebarProps) {
  const theme = useTheme();
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const servers = useStore((s) => s.servers);
  const minioAssets = useStore((s) => s.minioAssets);
  const sessions = useStore((s) => s.sessions);
  const openSession = useStore((s) => s.openSession);
  const themeId = useStore((s) => s.settings.themeId);
  const preset = getThemePreset(themeId);

  const groupedServers = servers.reduce((acc, server) => {
    const group = server.group || "Default";
    if (!acc[group]) acc[group] = [];
    acc[group].push(server);
    return acc;
  }, {} as Record<string, ServerAsset[]>);

  const groupedMinios = minioAssets.reduce((acc, minio) => {
    const group = minio.group || "Default";
    if (!acc[group]) acc[group] = [];
    acc[group].push(minio);
    return acc;
  }, {} as Record<string, MinioAsset[]>);

  const allGroups = Array.from(
    new Set([...Object.keys(groupedServers), ...Object.keys(groupedMinios)])
  ).sort();

  const totalAssets = servers.length + minioAssets.length;

  const primaryHex = preset.primary;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
          background: preset.background.default,
          borderRight: `1px solid ${preset.divider}`,
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1.25 }}>
        <Avatar
          sx={{
            width: 28,
            height: 28,
            background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`,
          }}
        >
          <TerminalIcon sx={{ fontSize: 16 }} />
        </Avatar>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1, color: preset.text.primary }}>RSM</Typography>
          <Typography variant="caption" sx={{ fontSize: 9.5, color: preset.text.secondary }}>
            SSH Manager
          </Typography>
        </Box>
      </Box>

      <List dense disablePadding sx={{ py: 0.5 }}>
        {NAV_ITEMS.map((item) => (
          <ListItem key={item.view} disablePadding>
            <ListItemButton
              selected={view === item.view}
              onClick={() => setView(item.view)}
              sx={{
                py: 0.25,
                color: preset.text.primary,
                "&.Mui-selected": {
                  bgcolor: `${primaryHex}1f`,
                  "&:hover": { bgcolor: `${primaryHex}2e` },
                  "& .MuiListItemIcon-root": { color: primaryHex },
                  "& .MuiListItemText-primary": { color: primaryHex },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 30, color: preset.text.secondary }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
              {item.view === "terminal" && sessions.length > 0 && (
                <Chip label={sessions.length} size="small" color="primary" />
              )}
              {item.view === "assets" && (servers.length + minioAssets.length) > 0 && (
                <Chip label={servers.length + minioAssets.length} size="small" variant="outlined" />
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 0.5, borderColor: preset.divider }} />

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, py: 0.5 }}>
        <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600, color: preset.text.secondary }}>
          QUICK CONNECT
        </Typography>
        <Tooltip title="Add Asset">
          <IconButton
            onClick={(e) => setAddAnchor(e.currentTarget)}
            sx={{ p: 0.5, color: preset.text.secondary }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={addAnchor}
          open={Boolean(addAnchor)}
          onClose={() => setAddAnchor(null)}
          PaperProps={{ sx: { minWidth: 170 } }}
        >
          <MenuItem onClick={() => { setAddAnchor(null); onAddServer(); }}>
            <ListItemIcon><ServerIcon sx={{ fontSize: 18 }} /></ListItemIcon>
            <ListItemText primary="SSH Server" primaryTypographyProps={{ fontSize: 13 }} />
          </MenuItem>
          <MenuItem onClick={() => { setAddAnchor(null); onAddMinio(); }}>
            <ListItemIcon><MinioIcon sx={{ fontSize: 18 }} /></ListItemIcon>
            <ListItemText primary="MinIO / S3" primaryTypographyProps={{ fontSize: 13 }} />
          </MenuItem>
        </Menu>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto" }}>
        {totalAssets === 0 ? (
          <Typography variant="caption" sx={{ display: "block", px: 2, py: 0.5, fontStyle: "italic", color: preset.text.secondary }}>
            No assets yet
          </Typography>
        ) : (
          allGroups.map((group) => {
            const groupServers = groupedServers[group] || [];
            const groupMinios = groupedMinios[group] || [];
            return (
              <Box key={group}>
                <Typography
                  variant="caption"
                  sx={{
                    display: "block", px: 2, py: 0.25,
                    fontWeight: 600, textTransform: "uppercase",
                    fontSize: 9.5, letterSpacing: 0.5,
                    color: preset.text.secondary,
                  }}
                >
                  {group}
                </Typography>
                <List dense disablePadding>
                  {/* SSH servers */}
                  {groupServers.map((server) => {
                    const activeSession = sessions.find(
                      (s) => s.serverId === server.id && s.status === "connected"
                    );
                    return (
                      <ListItem key={server.id} disablePadding>
                        <Tooltip title={`${server.host}:${server.port}`} placement="right">
                          <ListItemButton
                            onClick={() => openSession(server)}
                            sx={{ py: 0.25, color: preset.text.primary }}
                          >
                            <ListItemIcon sx={{ minWidth: 28 }}>
                              <PowerIcon
                                sx={{ fontSize: 15, color: activeSession ? preset.success : preset.text.secondary }}
                              />
                            </ListItemIcon>
                            <ListItemText
                              primary={server.name}
                              primaryTypographyProps={{ fontSize: 12, noWrap: true }}
                            />
                          </ListItemButton>
                        </Tooltip>
                      </ListItem>
                    );
                  })}
                  {/* MinIO assets */}
                  {groupMinios.map((minio) => (
                    <ListItem key={minio.id} disablePadding>
                      <Tooltip title={`${minio.useSSL ? "https" : "http"}://${minio.endpoint}:${minio.port}`} placement="right">
                        <ListItemButton
                          onClick={() => { setView("assets"); }}
                          sx={{ py: 0.25, color: preset.text.primary }}
                        >
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <MinioIcon
                              sx={{ fontSize: 15, color: preset.secondary }}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={minio.name}
                            primaryTypographyProps={{ fontSize: 12, noWrap: true }}
                          />
                        </ListItemButton>
                      </Tooltip>
                    </ListItem>
                  ))}
                </List>
              </Box>
            );
          })
        )}
      </Box>

      <Divider sx={{ borderColor: preset.divider }} />
      <Box sx={{ px: 1.5, py: 0.75 }}>
        <Typography variant="caption" sx={{ fontSize: 9, color: preset.text.secondary }}>
          v0.1.0 · Tauri + Rust
        </Typography>
      </Box>
    </Drawer>
  );
}
