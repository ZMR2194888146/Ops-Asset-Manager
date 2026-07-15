import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Alert,
  CircularProgress,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Breadcrumbs,
  Link,
  Chip,
} from "@mui/material";
import {
  FolderRounded,
  InsertDriveFileRounded,
  ArrowBackRounded,
  RefreshRounded,
  CreateNewFolderRounded,
  DeleteRounded,
  DownloadRounded,
  UploadRounded,
  CloudRounded,
  StorageRounded,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { useStore } from "../stores/store";
import { getThemePreset } from "../theme/presets";
import type { MinioAsset, S3Entry } from "../types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatTime(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function minioConfig(asset: MinioAsset) {
  return {
    endpoint: asset.endpoint,
    port: asset.port,
    access_key: asset.accessKey,
    secret_key: asset.secretKey,
    region: asset.region,
    use_ssl: asset.useSSL,
  };
}

interface MinioBrowserProps {
  asset: MinioAsset;
}

export function MinioBrowser({ asset }: MinioBrowserProps) {
  const themeId = useStore((s) => s.settings.themeId);
  const preset = getThemePreset(themeId);

  const [buckets, setBuckets] = useState<S3Entry[]>([]);
  const [activeBucket, setActiveBucket] = useState<string | null>(asset.defaultBucket || null);
  const [entries, setEntries] = useState<S3Entry[]>([]);
  const [prefix, setPrefix] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [createBucketOpen, setCreateBucketOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const loadBuckets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await invoke<S3Entry[]>("minio_list_buckets", { config: minioConfig(asset) });
      setBuckets(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [asset]);

  const loadObjects = useCallback(async (bucket: string, p: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await invoke<S3Entry[]>("minio_list_objects", {
        config: minioConfig(asset),
        bucket,
        prefix: p,
      });
      setEntries(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [asset]);

  useEffect(() => {
    loadBuckets();
  }, [loadBuckets]);

  useEffect(() => {
    if (activeBucket) {
      setPrefix("");
      setSelected(null);
      loadObjects(activeBucket, "");
    } else {
      setEntries([]);
    }
  }, [activeBucket, loadObjects]);

  const handleEntryClick = (entry: S3Entry) => {
    if (entry.isDir) {
      setSelected(null);
      if (activeBucket) {
        const newPrefix = entry.key.endsWith("/") ? entry.key : `${entry.key}/`;
        setPrefix(newPrefix);
        loadObjects(activeBucket, newPrefix);
      }
    } else {
      setSelected(entry.key === selected ? null : entry.key);
    }
  };

  const goUp = () => {
    if (!activeBucket) return;
    const parts = prefix.split("/").filter(Boolean);
    parts.pop();
    const newPrefix = parts.length > 0 ? parts.join("/") + "/" : "";
    setPrefix(newPrefix);
    loadObjects(activeBucket, newPrefix);
  };

  const prefixParts = prefix.split("/").filter(Boolean);

  const handleCreateBucket = async () => {
    if (!newBucketName.trim()) return;
    try {
      await invoke("minio_create_bucket", { config: minioConfig(asset), bucket: newBucketName.trim() });
      setCreateBucketOpen(false);
      setNewBucketName("");
      loadBuckets();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDeleteBucket = async (bucketName: string) => {
    try {
      await invoke("minio_delete_bucket", { config: minioConfig(asset), bucket: bucketName });
      if (activeBucket === bucketName) {
        setActiveBucket(null);
      }
      loadBuckets();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !activeBucket) return;
    const folderKey = prefix + newFolderName.trim() + "/";
    try {
      await invoke("minio_upload_object", {
        config: minioConfig(asset),
        bucket: activeBucket,
        key: folderKey,
        data: [],
      });
      setCreateFolderOpen(false);
      setNewFolderName("");
      loadObjects(activeBucket, prefix);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleUpload = async () => {
    if (!activeBucket) return;
    const localPath = await openDialog({ multiple: false });
    if (!localPath || typeof localPath !== "string") return;
    const fileName = localPath.split("/").pop() || "upload";
    const key = prefix + fileName;
    try {
      const data = await readFile(localPath);
      await invoke("minio_upload_object", {
        config: minioConfig(asset),
        bucket: activeBucket,
        key,
        data: Array.from(data),
      });
      loadObjects(activeBucket, prefix);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDownload = async () => {
    if (!selected || !activeBucket) return;
    const entry = entries.find((e) => e.key === selected);
    if (!entry || entry.isDir) return;
    try {
      const data = await invoke<number[]>("minio_download_object", {
        config: minioConfig(asset),
        bucket: activeBucket,
        key: selected,
      });
      const localPath = await saveDialog({ defaultPath: entry.name });
      if (localPath) {
        await writeFile(localPath, new Uint8Array(data));
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDelete = async () => {
    if (!selected || !activeBucket) return;
    try {
      await invoke("minio_delete_object", {
        config: minioConfig(asset),
        bucket: activeBucket,
        key: selected,
      });
      loadObjects(activeBucket, prefix);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleNavigateToPrefix = (index: number) => {
    if (!activeBucket) return;
    const parts = prefixParts.slice(0, index + 1);
    const newPrefix = parts.join("/") + "/";
    setPrefix(newPrefix);
    loadObjects(activeBucket, newPrefix);
  };

  return (
    <Box sx={{ height: "100%", display: "flex", overflow: "hidden" }}>
      {/* Left: buckets list */}
      <Box sx={{ width: 220, minWidth: 220, borderRight: `1px solid ${preset.divider}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1, py: 0.5, borderBottom: `1px solid ${preset.divider}` }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <StorageRounded sx={{ fontSize: 16, color: "primary.main" }} />
            <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600 }}>Buckets</Typography>
          </Stack>
          <Tooltip title="Create Bucket">
            <IconButton onClick={() => setCreateBucketOpen(true)} sx={{ p: 0.5 }}>
              <CreateNewFolderRounded sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ flex: 1, overflow: "auto" }}>
          {buckets.map((bucket) => (
            <Box
              key={bucket.key}
              onClick={() => setActiveBucket(bucket.name)}
              sx={{
                display: "flex", alignItems: "center", px: 1, py: 0.5,
                cursor: "pointer", gap: 0.5,
                bgcolor: activeBucket === bucket.name ? `${preset.primary}1f` : "transparent",
                "&:hover": { bgcolor: activeBucket === bucket.name ? `${preset.primary}2e` : `${preset.primary}10` },
              }}
            >
              <FolderRounded sx={{ fontSize: 15, color: activeBucket === bucket.name ? "primary.main" : "text.secondary" }} />
              <Typography sx={{ fontSize: 12, flex: 1, fontWeight: activeBucket === bucket.name ? 600 : 400 }} noWrap>
                {bucket.name}
              </Typography>
              <IconButton
                size="small"
                sx={{ p: 0.25, opacity: 0.3, "&:hover": { opacity: 1, color: "error.main" } }}
                onClick={(e) => { e.stopPropagation(); handleDeleteBucket(bucket.name); }}
              >
                <DeleteRounded sx={{ fontSize: 13 }} />
              </IconButton>
            </Box>
          ))}
          {buckets.length === 0 && !loading && (
            <Typography variant="caption" sx={{ display: "block", px: 2, py: 1, color: "text.secondary" }}>
              No buckets
            </Typography>
          )}
        </Box>
      </Box>

      {/* Right: objects table */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Toolbar */}
        {activeBucket ? (
          <>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 1, py: 0.5, borderBottom: `1px solid ${preset.divider}`, flexShrink: 0 }}>
              <Tooltip title="Back"><span><IconButton onClick={goUp} disabled={prefix === ""} sx={{ p: 0.5 }}><ArrowBackRounded sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
              <Tooltip title="Refresh"><IconButton onClick={() => loadObjects(activeBucket, prefix)} sx={{ p: 0.5 }}><RefreshRounded sx={{ fontSize: 16 }} /></IconButton></Tooltip>

              <Breadcrumbs sx={{ flex: 1, fontSize: 12, "& .MuiBreadcrumbs-separator": { mx: 0.5 } }}>
                <Link
                  component="button"
                  underline="hover"
                  sx={{ fontSize: 12, display: "flex", alignItems: "center", gap: 0.5 }}
                  onClick={() => { setPrefix(""); loadObjects(activeBucket, ""); }}
                >
                  <FolderRounded sx={{ fontSize: 14, color: "primary.main" }} />
                  {activeBucket}
                </Link>
                {prefixParts.map((part, i) => (
                  <Link
                    key={i}
                    component="button"
                    underline="hover"
                    sx={{ fontSize: 12 }}
                    onClick={() => handleNavigateToPrefix(i)}
                  >
                    {part}
                  </Link>
                ))}
              </Breadcrumbs>

              <Tooltip title="New Folder"><IconButton onClick={() => setCreateFolderOpen(true)} sx={{ p: 0.5 }}><CreateNewFolderRounded sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              <Tooltip title="Upload"><IconButton onClick={handleUpload} sx={{ p: 0.5 }}><UploadRounded sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              <Tooltip title="Download"><span><IconButton onClick={handleDownload} disabled={!selected || !!entries.find(e => e.key === selected && e.isDir)} sx={{ p: 0.5 }}><DownloadRounded sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
              <Tooltip title="Delete"><span><IconButton onClick={handleDelete} disabled={!selected} color="error" sx={{ p: 0.5 }}><DeleteRounded sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
            </Stack>

            {error && <Alert severity="error" sx={{ borderRadius: 0, fontSize: 11 }} onClose={() => setError("")}>{error}</Alert>}

            <TableContainer sx={{ flex: 1, overflow: "auto" }}>
              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={20} /></Box>
              ) : entries.length === 0 ? (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 6, color: "text.secondary" }}>
                  <CloudRounded sx={{ fontSize: 36, opacity: 0.2 }} />
                  <Typography variant="caption" sx={{ mt: 0.5 }}>Bucket is empty</Typography>
                </Box>
              ) : (
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: "50%" }}>Name</TableCell>
                      <TableCell sx={{ width: "15%" }}>Size</TableCell>
                      <TableCell sx={{ width: "35%" }}>Modified</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {entries.map((entry, idx) => (
                      <TableRow
                        key={entry.key}
                        hover
                        selected={selected === entry.key}
                        onClick={() => handleEntryClick(entry)}
                        sx={{
                          cursor: "pointer",
                          height: 28,
                          bgcolor: idx % 2 === 1 ? "rgba(255,255,255,0.02)" : "transparent",
                          "&.Mui-selected": { bgcolor: `${preset.primary}1f` },
                          "&:hover": { bgcolor: `${preset.primary}10` },
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {entry.isDir ? (
                              <FolderRounded sx={{ fontSize: 14, color: "primary.main" }} />
                            ) : (
                              <InsertDriveFileRounded sx={{ fontSize: 14, color: "text.secondary" }} />
                            )}
                            <Typography sx={{ fontSize: 11, fontWeight: entry.isDir ? 600 : 400 }} noWrap>{entry.name}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 10 }}>
                            {entry.isDir ? "-" : formatSize(entry.size)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{formatTime(entry.lastModified)}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TableContainer>

            <Box sx={{ px: 1, py: 0.25, borderTop: `1px solid ${preset.divider}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9.5 }}>
                {entries.length} item(s) {selected ? `· ${selected}` : ""}
              </Typography>
            </Box>
          </>
        ) : (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "text.secondary" }}>
            <StorageRounded sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
            <Typography variant="subtitle1">Select a bucket</Typography>
            <Typography variant="caption">Choose a bucket from the left panel</Typography>
          </Box>
        )}
      </Box>

      {/* Create bucket dialog */}
      <Dialog open={createBucketOpen} onClose={() => setCreateBucketOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Bucket</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            value={newBucketName}
            onChange={(e) => setNewBucketName(e.target.value)}
            placeholder="my-bucket"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateBucket(); }}
            sx={{ mt: 0.5 }}
            helperText="Bucket names must be globally unique, lowercase"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateBucketOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateBucket} disabled={!newBucketName.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Create folder dialog */}
      <Dialog open={createFolderOpen} onClose={() => setCreateFolderOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="folder_name"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
            sx={{ mt: 0.5 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFolderOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
