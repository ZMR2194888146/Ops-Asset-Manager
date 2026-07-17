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
  Chip,
  Tooltip,
  Alert,
  CircularProgress,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  FolderRounded,
  InsertDriveFileRounded,
  ArrowBackRounded,
  RefreshRounded,
  HomeRounded,
  CreateNewFolderRounded,
  DeleteRounded,
  DownloadRounded,
  UploadRounded,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { useStore } from "../stores/store";
import { getThemePreset } from "../theme/presets";
import { getRemoteCwd, onRemoteCwdChange } from "../utils/terminalRegistry";
import type { FileEntry } from "../types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatTime(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function FileManager({ sessionId }: { sessionId: string }) {
  const themeId = useStore((s) => s.settings.themeId);
  const preset = getThemePreset(themeId);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("/");
  const [pathInput, setPathInput] = useState("/");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sftpReady, setSftpReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState("");

  const loadDir = useCallback(async (path: string) => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      if (!sftpReady) {
        await invoke("sftp_init", { sessionId });
        setSftpReady(true);
      }
      const result = await invoke<FileEntry[]>("sftp_list", { sessionId, path });
      setEntries(result);
      setCurrentPath(path);
      setPathInput(path);
      setSelected(null);
    } catch (e) {
      setError(String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, sftpReady]);

  useEffect(() => {
    if (sessionId) {
      setSftpReady(false);
      loadDir("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Auto-follow SFTP to terminal's CWD (tracked via cd command parsing)
  useEffect(() => {
    if (!sessionId) return;

    // Load initial CWD if already known
    const initial = getRemoteCwd(sessionId);
    if (initial) loadDir(initial);

    // Subscribe to CWD changes from cd commands
    const unsubscribe = onRemoteCwdChange(sessionId, (cwd) => {
      loadDir(cwd);
    });
    return unsubscribe;
  }, [sessionId, loadDir]);

  const navigateTo = (path: string) => loadDir(path);

  const goUp = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    navigateTo("/" + parts.join("/"));
  };

  const handleRowClick = (entry: FileEntry) => {
    if (entry.is_dir) {
      navigateTo(entry.path);
    } else {
      setSelected(entry.path === selected ? null : entry.path);
    }
  };

  const handleMkdir = async () => {
    if (!mkdirName.trim()) return;
    const fullPath = currentPath.endsWith("/") ? `${currentPath}${mkdirName}` : `${currentPath}/${mkdirName}`;
    try {
      await invoke("sftp_mkdir", { sessionId, path: fullPath });
      setMkdirOpen(false);
      setMkdirName("");
      loadDir(currentPath);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const entry = entries.find((e) => e.path === selected);
    try {
      await invoke("sftp_remove", { sessionId, path: selected, isDir: entry?.is_dir || false });
      loadDir(currentPath);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDownload = async () => {
    if (!selected) return;
    const entry = entries.find((e) => e.path === selected);
    if (!entry || entry.is_dir) return;
    try {
      const data = await invoke<number[]>("sftp_read_file", { sessionId, path: selected });
      const localPath = await saveDialog({ defaultPath: entry.name });
      if (localPath) {
        await writeFile(localPath, new Uint8Array(data));
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const handleUpload = async () => {
    const localPath = await openDialog({ multiple: false });
    if (!localPath || typeof localPath !== "string") return;
    const fileName = localPath.split("/").pop() || "upload";
    const remotePath = currentPath.endsWith("/") ? `${currentPath}${fileName}` : `${currentPath}/${fileName}`;
    try {
      const data = await readFile(localPath);
      await invoke("sftp_write_file", { sessionId, path: remotePath, data: Array.from(data) });
      loadDir(currentPath);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", px: 1, py: 0.5, borderBottom: `1px solid ${preset.divider}`, flexShrink: 0 }}>
        <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: "primary.main" }}>
          SFTP
        </Typography>
      </Box>

      {/* Toolbar */}
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 0.5, py: 0.5, borderBottom: `1px solid ${preset.divider}`, flexShrink: 0 }}>
        <Tooltip title="Back"><span><IconButton onClick={goUp} disabled={currentPath === "/"} sx={{ p: 0.5 }}><ArrowBackRounded sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
        <Tooltip title="Home"><IconButton onClick={() => navigateTo("/")} sx={{ p: 0.5 }}><HomeRounded sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        <Tooltip title="Refresh"><IconButton onClick={() => loadDir(currentPath)} sx={{ p: 0.5 }}><RefreshRounded sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        <TextField
          fullWidth
          size="small"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") navigateTo(pathInput); }}
          sx={{ "& .MuiOutlinedInput-root": { fontFamily: "monospace", fontSize: 11, padding: "2px 6px" } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><FolderRounded sx={{ fontSize: 13, color: "primary.main" }} /></InputAdornment> }}
        />
        <Tooltip title="New Folder"><IconButton onClick={() => setMkdirOpen(true)} sx={{ p: 0.5 }}><CreateNewFolderRounded sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        <Tooltip title="Upload"><IconButton onClick={handleUpload} sx={{ p: 0.5 }}><UploadRounded sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        <Tooltip title="Download"><span><IconButton onClick={handleDownload} disabled={!selected || !!entries.find(e => e.path === selected && e.is_dir)} sx={{ p: 0.5 }}><DownloadRounded sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
        <Tooltip title="Delete"><span><IconButton onClick={handleDelete} disabled={!selected} color="error" sx={{ p: 0.5 }}><DeleteRounded sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
      </Stack>

      {error && <Alert severity="error" sx={{ borderRadius: 0, fontSize: 11 }} onClose={() => setError("")}>{error}</Alert>}

      {/* File list */}
      <TableContainer sx={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={20} /></Box>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: "45%" }}>Name</TableCell>
                <TableCell sx={{ width: "15%" }}>Size</TableCell>
                <TableCell sx={{ width: "25%" }}>Modified</TableCell>
                <TableCell sx={{ width: "15%" }}>Perms</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry, idx) => (
                <TableRow
                  key={entry.path}
                  hover
                  selected={selected === entry.path}
                  onClick={() => handleRowClick(entry)}
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
                      {entry.is_dir ? (
                        <FolderRounded sx={{ fontSize: 14, color: "primary.main" }} />
                      ) : (
                        <InsertDriveFileRounded sx={{ fontSize: 14, color: "text.secondary" }} />
                      )}
                      <Typography sx={{ fontSize: 11, fontWeight: entry.is_dir ? 600 : 400 }} noWrap>{entry.name}</Typography>
                      {entry.is_symlink && <Chip label="link" size="small" sx={{ height: 12, fontSize: 8 }} />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 10 }}>
                      {entry.is_dir ? "-" : formatSize(entry.size)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{formatTime(entry.modified)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 10 }}>
                      {entry.permissions ? (entry.permissions & 0o777).toString(8) : "-"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Status bar */}
      <Box sx={{ px: 1, py: 0.25, borderTop: `1px solid ${preset.divider}` }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9.5 }}>
          {entries.length} item(s) {sftpReady ? "" : "(SFTP initializing...)"}
        </Typography>
      </Box>

      {/* Mkdir dialog */}
      <Dialog open={mkdirOpen} onClose={() => setMkdirOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Folder</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth value={mkdirName} onChange={(e) => setMkdirName(e.target.value)} placeholder="folder_name" onKeyDown={(e) => { if (e.key === "Enter") handleMkdir(); }} sx={{ mt: 0.5 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMkdirOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleMkdir} disabled={!mkdirName.trim()}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
