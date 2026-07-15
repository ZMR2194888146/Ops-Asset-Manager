import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  Grid,
  Avatar,
  Alert,
  Button,
  Stack,
} from "@mui/material";
import {
  MoreVertRounded,
  EditRounded,
  DeleteRounded,
  PlayArrowRounded,
  SearchRounded,
  ContentCopyRounded,
  CloudOffRounded,
  DnsRounded,
  AddRounded,
  CloudRounded,
  ArrowBackRounded,
  LockRounded,
} from "@mui/icons-material";
import { useStore } from "../stores/store";
import type { ServerAsset, MinioAsset } from "../types";
import { ServerDialog } from "./ServerDialog";
import { MinioDialog } from "./MinioDialog";
import { MinioBrowser } from "./MinioBrowser";

type AssetType = "ssh" | "minio";

export function AssetManager() {
  const servers = useStore((s) => s.servers);
  const minioAssets = useStore((s) => s.minioAssets);
  const openSession = useStore((s) => s.openSession);
  const deleteServer = useStore((s) => s.deleteServer);
  const deleteMinioAsset = useStore((s) => s.deleteMinioAsset);
  const addServer = useStore((s) => s.addServer);
  const addMinioAsset = useStore((s) => s.addMinioAsset);

  const [search, setSearch] = useState("");
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [minioDialogOpen, setMinioDialogOpen] = useState(false);
  const [editServer, setEditServer] = useState<ServerAsset | null>(null);
  const [editMinio, setEditMinio] = useState<MinioAsset | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuType, setMenuType] = useState<AssetType | null>(null);
  const [menuServer, setMenuServer] = useState<ServerAsset | null>(null);
  const [menuMinio, setMenuMinio] = useState<MinioAsset | null>(null);
  const [addAnchor, setAddAnchor] = useState<null | HTMLElement>(null);
  const [browsingMinio, setBrowsingMinio] = useState<MinioAsset | null>(null);

  // --- Inline MinIO browser ---
  if (browsingMinio) {
    return (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
          <IconButton onClick={() => setBrowsingMinio(null)} sx={{ p: 0.5 }}>
            <ArrowBackRounded sx={{ fontSize: 18 }} />
          </IconButton>
          <Avatar sx={{ width: 28, height: 28, bgcolor: "rgba(124, 92, 252, 0.15)", color: "secondary.main" }}>
            <CloudRounded sx={{ fontSize: 16 }} />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap sx={{ fontSize: 14, fontWeight: 600 }}>
              {browsingMinio.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 10.5 }} noWrap>
              {browsingMinio.useSSL ? "https" : "http"}://{browsingMinio.endpoint}:{browsingMinio.port}
            </Typography>
          </Box>
          <Chip label={browsingMinio.region} size="small" variant="outlined" sx={{ fontSize: 10 }} />
        </Box>
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <MinioBrowser asset={browsingMinio} />
        </Box>
      </Box>
    );
  }

  const filterFn = (text: string) => text.toLowerCase().includes(search.toLowerCase());

  const filteredServers = servers.filter(
    (s) => filterFn(s.name) || filterFn(s.host) || filterFn(s.username) || s.tags?.some((t) => filterFn(t))
  );
  const filteredMinios = minioAssets.filter(
    (m) => filterFn(m.name) || filterFn(m.endpoint) || m.tags?.some((t) => filterFn(t))
  );

  const allGroups = new Set<string>([
    ...filteredServers.map((s) => s.group || "Default"),
    ...filteredMinios.map((m) => m.group || "Default"),
  ]);
  const groupNames = Array.from(allGroups).sort();

  const totalCount = servers.length + minioAssets.length;

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, server: ServerAsset) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuType("ssh");
    setMenuServer(server);
    setMenuMinio(null);
  };
  const handleMenuOpenMinio = (e: React.MouseEvent<HTMLElement>, minio: MinioAsset) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuType("minio");
    setMenuMinio(minio);
    setMenuServer(null);
  };
  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuType(null);
    setMenuServer(null);
    setMenuMinio(null);
  };

  const handleDuplicate = () => {
    if (menuType === "ssh" && menuServer) {
      addServer({
        ...menuServer,
        id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${menuServer.name} (copy)`,
      });
    } else if (menuType === "minio" && menuMinio) {
      addMinioAsset({
        ...menuMinio,
        id: `minio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${menuMinio.name} (copy)`,
      });
    }
    handleMenuClose();
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Assets
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {totalCount} asset{totalCount !== 1 ? "s" : ""} ({servers.length} SSH · {minioAssets.length} MinIO)
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={(e) => setAddAnchor(e.currentTarget)}
        >
          Add Asset
        </Button>
        <Menu
          anchorEl={addAnchor}
          open={Boolean(addAnchor)}
          onClose={() => setAddAnchor(null)}
          PaperProps={{ sx: { minWidth: 170 } }}
        >
          <MenuItem onClick={() => { setAddAnchor(null); setEditServer(null); setServerDialogOpen(true); }}>
            <ListItemIcon><DnsRounded sx={{ fontSize: 18 }} /></ListItemIcon>
            <ListItemText primary="SSH Server" primaryTypographyProps={{ fontSize: 13 }} />
          </MenuItem>
          <MenuItem onClick={() => { setAddAnchor(null); setEditMinio(null); setMinioDialogOpen(true); }}>
            <ListItemIcon><CloudRounded sx={{ fontSize: 18 }} /></ListItemIcon>
            <ListItemText primary="MinIO / S3" primaryTypographyProps={{ fontSize: 13 }} />
          </MenuItem>
        </Menu>
      </Box>

      <TextField
        fullWidth
        placeholder="Search by name, host, endpoint, or tag..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRounded sx={{ fontSize: 18 }} />
            </InputAdornment>
          ),
        }}
      />

      {totalCount === 0 ? (
        <Card sx={{ textAlign: "center", py: 6, px: 3 }}>
          <CloudOffRounded sx={{ fontSize: 48, color: "text.secondary", opacity: 0.3 }} />
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 1.5 }}>
            No assets configured
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            Add an SSH server or MinIO connection to get started
          </Typography>
          <Button variant="outlined" startIcon={<AddRounded />} onClick={(e) => setAddAnchor(e.currentTarget)}>
            Add Asset
          </Button>
        </Card>
      ) : groupNames.length === 0 ? (
        <Alert severity="info">No assets match your search.</Alert>
      ) : (
        groupNames.map((group) => {
          const groupServers = filteredServers.filter((s) => (s.group || "Default") === group);
          const groupMinios = filteredMinios.filter((m) => (m.group || "Default") === group);
          return (
            <Box key={group} sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10.5, display: "block" }}>
                {group} ({groupServers.length + groupMinios.length})
              </Typography>
              <Grid container spacing={1.5}>
                {/* SSH server cards */}
                {groupServers.map((server) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={server.id}>
                    <Card
                      sx={{
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        "&:hover": { borderColor: "primary.main", transform: "translateY(-1px)" },
                      }}
                      onClick={() => openSession(server)}
                    >
                      <CardContent>
                        <Box sx={{ display: "flex", alignItems: "flex-start", mb: 0.75 }}>
                          <Avatar sx={{ width: 30, height: 30, bgcolor: "rgba(63, 143, 212, 0.15)", color: "primary.main" }}>
                            <DnsRounded sx={{ fontSize: 17 }} />
                          </Avatar>
                          <Box sx={{ flex: 1, ml: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
                              {server.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 10.5 }} noWrap>
                              {server.username}@{server.host}:{server.port}
                            </Typography>
                          </Box>
                          <IconButton onClick={(e) => handleMenuOpen(e, server)} sx={{ p: 0.25 }}>
                            <MoreVertRounded sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>

                        {server.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", mb: 0.75, fontSize: 11 }}>
                            {server.description}
                          </Typography>
                        )}

                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                          <Chip label="SSH" size="small" sx={{ bgcolor: "rgba(63, 143, 212, 0.12)", fontSize: 10 }} />
                          <Chip label={server.authMethod === "key" ? "Key" : "Password"} variant="outlined" />
                          {server.tags?.map((tag) => (
                            <Chip key={tag} label={tag} sx={{ bgcolor: "rgba(124, 92, 252, 0.12)" }} />
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}

                {/* MinIO asset cards */}
                {groupMinios.map((minio) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={minio.id}>
                    <Card
                      sx={{
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        "&:hover": { borderColor: "secondary.main", transform: "translateY(-1px)" },
                      }}
                      onClick={() => setBrowsingMinio(minio)}
                    >
                      <CardContent>
                        <Box sx={{ display: "flex", alignItems: "flex-start", mb: 0.75 }}>
                          <Avatar sx={{ width: 30, height: 30, bgcolor: "rgba(124, 92, 252, 0.15)", color: "secondary.main" }}>
                            <CloudRounded sx={{ fontSize: 17 }} />
                          </Avatar>
                          <Box sx={{ flex: 1, ml: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
                              {minio.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 10.5 }} noWrap>
                              {minio.useSSL ? "https" : "http"}://{minio.endpoint}:{minio.port}
                            </Typography>
                          </Box>
                          <IconButton onClick={(e) => handleMenuOpenMinio(e, minio)} sx={{ p: 0.25 }}>
                            <MoreVertRounded sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>

                        {minio.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", mb: 0.75, fontSize: 11 }}>
                            {minio.description}
                          </Typography>
                        )}

                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                          <Chip label="MinIO" size="small" sx={{ bgcolor: "rgba(124, 92, 252, 0.12)", fontSize: 10 }} />
                          {minio.defaultBucket && (
                            <Chip label={minio.defaultBucket} size="small" sx={{ bgcolor: "rgba(124, 92, 252, 0.12)" }} />
                          )}
                          {minio.tags?.map((tag) => (
                            <Chip key={tag} label={tag} size="small" sx={{ bgcolor: "rgba(124, 92, 252, 0.12)" }} />
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          );
        })
      )}

      {/* Context menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose} PaperProps={{ sx: { minWidth: 160 } }}>
        {menuType === "ssh" && (
          <>
            <MenuItem onClick={() => { if (menuServer) openSession(menuServer); handleMenuClose(); }}>
              <ListItemIcon><PlayArrowRounded fontSize="small" /></ListItemIcon>
              <ListItemText>Connect</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { if (menuServer) { setEditServer(menuServer); setServerDialogOpen(true); } handleMenuClose(); }}>
              <ListItemIcon><EditRounded fontSize="small" /></ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
          </>
        )}
        {menuType === "minio" && (
          <>
            <MenuItem onClick={() => { if (menuMinio) setBrowsingMinio(menuMinio); handleMenuClose(); }}>
              <ListItemIcon><CloudRounded fontSize="small" /></ListItemIcon>
              <ListItemText>Browse</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { if (menuMinio) { setEditMinio(menuMinio); setMinioDialogOpen(true); } handleMenuClose(); }}>
              <ListItemIcon><EditRounded fontSize="small" /></ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
          </>
        )}
        <MenuItem onClick={handleDuplicate}>
          <ListItemIcon><ContentCopyRounded fontSize="small" /></ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuType === "ssh" && menuServer) deleteServer(menuServer.id);
            if (menuType === "minio" && menuMinio) deleteMinioAsset(menuMinio.id);
            handleMenuClose();
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon><DeleteRounded fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <ServerDialog open={serverDialogOpen} onClose={() => setServerDialogOpen(false)} editServer={editServer} />
      <MinioDialog open={minioDialogOpen} onClose={() => setMinioDialogOpen(false)} editAsset={editMinio} />
    </Box>
  );
}
