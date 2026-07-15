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
  SearchRounded,
  ContentCopyRounded,
  CloudOffRounded,
  CloudRounded,
  AddRounded,
  ArrowBackRounded,
  LockRounded,
} from "@mui/icons-material";
import { useStore } from "../stores/store";
import type { MinioAsset } from "../types";
import { MinioDialog } from "./MinioDialog";
import { MinioBrowser } from "./MinioBrowser";

export function MinioManager() {
  const minioAssets = useStore((s) => s.minioAssets);
  const activeMinioId = useStore((s) => s.activeMinioId);
  const setActiveMinioId = useStore((s) => s.setActiveMinioId);
  const deleteMinioAsset = useStore((s) => s.deleteMinioAsset);
  const addMinioAsset = useStore((s) => s.addMinioAsset);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MinioAsset | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuAsset, setMenuAsset] = useState<MinioAsset | null>(null);

  const activeAsset = minioAssets.find((m) => m.id === activeMinioId) || null;

  const filtered = minioAssets.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.endpoint.includes(search) ||
      m.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const groups = filtered.reduce((acc, asset) => {
    const group = asset.group || "Default";
    if (!acc[group]) acc[group] = [];
    acc[group].push(asset);
    return acc;
  }, {} as Record<string, MinioAsset[]>);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, asset: MinioAsset) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuAsset(asset);
  };
  const handleMenuClose = () => { setMenuAnchor(null); setMenuAsset(null); };

  const handleDuplicate = () => {
    if (!menuAsset) return;
    addMinioAsset({
      ...menuAsset,
      id: `minio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${menuAsset.name} (copy)`,
    });
    handleMenuClose();
  };

  // If an active connection is selected, show the browser
  if (activeAsset) {
    return (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
          <IconButton onClick={() => setActiveMinioId(null)} sx={{ p: 0.5 }}>
            <ArrowBackRounded sx={{ fontSize: 18 }} />
          </IconButton>
          <Avatar sx={{ width: 28, height: 28, bgcolor: "rgba(124, 92, 252, 0.15)", color: "secondary.main" }}>
            <CloudRounded sx={{ fontSize: 16 }} />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap sx={{ fontSize: 14, fontWeight: 600 }}>
              {activeAsset.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 10.5 }} noWrap>
              {activeAsset.useSSL ? "https" : "http"}://{activeAsset.endpoint}:{activeAsset.port}
            </Typography>
          </Box>
          <Chip label={activeAsset.region} size="small" variant="outlined" sx={{ fontSize: 10 }} />
        </Box>
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <MinioBrowser asset={activeAsset} />
        </Box>
      </Box>
    );
  }

  // Otherwise show the connection cards
  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            MinIO Storage
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {minioAssets.length} connection{minioAssets.length !== 1 ? "s" : ""} configured
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => { setEditTarget(null); setDialogOpen(true); }}
        >
          Add Connection
        </Button>
      </Box>

      <TextField
        fullWidth
        placeholder="Search by name, endpoint, or tag..."
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

      {minioAssets.length === 0 ? (
        <Card sx={{ textAlign: "center", py: 6, px: 3 }}>
          <CloudOffRounded sx={{ fontSize: 48, color: "text.secondary", opacity: 0.3 }} />
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 1.5 }}>
            No MinIO connections
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            Add your first MinIO or S3-compatible storage
          </Typography>
          <Button variant="outlined" startIcon={<AddRounded />} onClick={() => { setEditTarget(null); setDialogOpen(true); }}>
            Add Connection
          </Button>
        </Card>
      ) : Object.keys(groups).length === 0 ? (
        <Alert severity="info">No connections match your search.</Alert>
      ) : (
        Object.entries(groups).map(([group, groupAssets]) => (
          <Box key={group} sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10.5, display: "block" }}>
              {group} ({groupAssets.length})
            </Typography>
            <Grid container spacing={1.5}>
              {groupAssets.map((asset) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={asset.id}>
                  <Card
                    sx={{
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      "&:hover": { borderColor: "secondary.main", transform: "translateY(-1px)" },
                    }}
                    onClick={() => setActiveMinioId(asset.id)}
                  >
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "flex-start", mb: 0.75 }}>
                        <Avatar sx={{ width: 30, height: 30, bgcolor: "rgba(124, 92, 252, 0.15)", color: "secondary.main" }}>
                          <CloudRounded sx={{ fontSize: 17 }} />
                        </Avatar>
                        <Box sx={{ flex: 1, ml: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
                            {asset.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 10.5 }} noWrap>
                            {asset.useSSL ? "https" : "http"}://{asset.endpoint}:{asset.port}
                          </Typography>
                        </Box>
                        <IconButton onClick={(e) => handleMenuOpen(e, asset)} sx={{ p: 0.25 }}>
                          <MoreVertRounded sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>

                      {asset.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", mb: 0.75, fontSize: 11 }}>
                          {asset.description}
                        </Typography>
                      )}

                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                        <Chip
                          icon={<LockRounded sx={{ fontSize: 12 }} />}
                          label={asset.accessKey}
                          size="small"
                          variant="outlined"
                          sx={{ maxWidth: 120, fontSize: 10 }}
                        />
                        {asset.defaultBucket && (
                          <Chip label={asset.defaultBucket} size="small" sx={{ bgcolor: "rgba(124, 92, 252, 0.12)" }} />
                        )}
                        {asset.tags?.map((tag) => (
                          <Chip key={tag} label={tag} size="small" sx={{ bgcolor: "rgba(124, 92, 252, 0.12)" }} />
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose} PaperProps={{ sx: { minWidth: 160 } }}>
        <MenuItem onClick={() => { if (menuAsset) setActiveMinioId(menuAsset.id); handleMenuClose(); }}>
          <ListItemIcon><CloudRounded fontSize="small" /></ListItemIcon>
          <ListItemText>Browse</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { if (menuAsset) { setEditTarget(menuAsset); setDialogOpen(true); } handleMenuClose(); }}>
          <ListItemIcon><EditRounded fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDuplicate}>
          <ListItemIcon><ContentCopyRounded fontSize="small" /></ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { if (menuAsset) deleteMinioAsset(menuAsset.id); handleMenuClose(); }} sx={{ color: "error.main" }}>
          <ListItemIcon><DeleteRounded fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <MinioDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editAsset={editTarget} />
    </Box>
  );
}
