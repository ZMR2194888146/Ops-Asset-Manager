import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Divider,
  Chip,
  Stack,
  InputAdornment,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  VpnKeyRounded,
  LockRounded,
  DescriptionRounded,
  TagRounded,
  FolderOpenRounded,
  PlagiarismRounded,
  CheckCircleRounded,
  ErrorRounded,
  AltRouteRounded,
  AddRounded,
  DeleteRounded,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useStore } from "../stores/store";
import { generateId } from "../utils/id";
import type { ServerAsset, DefaultForward } from "../types";

interface ServerDialogProps {
  open: boolean;
  onClose: () => void;
  editServer?: ServerAsset | null;
}

export function ServerDialog({ open, onClose, editServer }: ServerDialogProps) {
  const addServer = useStore((s) => s.addServer);
  const updateServer = useStore((s) => s.updateServer);

  const [form, setForm] = useState<ServerAsset>({
    id: "",
    name: "",
    host: "",
    port: 22,
    username: "root",
    authMethod: "password",
    password: "",
    privateKeyPath: "",
    privateKeyPassphrase: "",
    group: "Default",
    tags: [],
    description: "",
  });
  const [tab, setTab] = useState(0);
  const [tagInput, setTagInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  // Forward form state
  const [fwdDir, setFwdDir] = useState<"local" | "remote">("local");
  const [fwdForm, setFwdForm] = useState({ localPort: "", remoteHost: "127.0.0.1", remotePort: "" });

  useEffect(() => {
    if (editServer) {
      setForm(editServer);
    } else {
      setForm({
        id: "",
        name: "",
        host: "",
        port: 22,
        username: "root",
        authMethod: "password",
        password: "",
        privateKeyPath: "",
        privateKeyPassphrase: "",
        group: "Default",
        tags: [],
        description: "",
        defaultForwards: [],
      });
    }
    setTab(0);
  }, [editServer, open]);

  const handleAddForward = () => {
    const lp = parseInt(fwdForm.localPort);
    const rp = parseInt(fwdForm.remotePort);
    if (!lp || !rp || !fwdForm.remoteHost) return;
    const fwd: DefaultForward = { direction: fwdDir, localPort: lp, remoteHost: fwdForm.remoteHost, remotePort: rp };
    setForm({ ...form, defaultForwards: [...(form.defaultForwards || []), fwd] });
    setFwdForm({ localPort: "", remoteHost: "127.0.0.1", remotePort: "" });
  };

  const handleDeleteForward = (idx: number) => {
    setForm({ ...form, defaultForwards: (form.defaultForwards || []).filter((_, i) => i !== idx) });
  };

  const handleSave = () => {
    if (!form.name || !form.host) return;
    if (editServer) {
      updateServer(editServer.id, form);
    } else {
      addServer({ ...form, id: generateId("srv") });
    }
    onClose();
  };

  const handleTagAdd = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags?.includes(tag)) {
      setForm({ ...form, tags: [...(form.tags || []), tag] });
    }
    setTagInput("");
  };

  const handleTagDelete = (tag: string) => {
    setForm({ ...form, tags: form.tags?.filter((t) => t !== tag) });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<string>("ssh_test", {
        config: {
          host: form.host,
          port: form.port,
          username: form.username,
          auth_method: form.authMethod,
          password: form.password,
          private_key_path: form.privateKeyPath,
          private_key_passphrase: form.privateKeyPassphrase,
        },
      });
      setTestResult({ ok: true, message: result });
    } catch (e) {
      setTestResult({ ok: false, message: String(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 18, fontWeight: 600 }}>
        {editServer ? "Edit Server" : "Add Server"}
      </DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
          <Tab icon={<LockRounded fontSize="small" />} iconPosition="start" label="Connection" />
          <Tab icon={<DescriptionRounded fontSize="small" />} iconPosition="start" label="Details" />
          <Tab icon={<AltRouteRounded fontSize="small" />} iconPosition="start" label="Forwarding" />
        </Tabs>

        {tab === 0 && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                label="Name"
                required
                fullWidth
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My Server"
              />
              <TextField
                label="Group"
                sx={{ width: 150 }}
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value })}
              />
            </Box>

            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                label="Host"
                required
                fullWidth
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="192.168.1.100"
              />
              <TextField
                label="Port"
                type="number"
                sx={{ width: 100 }}
                value={form.port}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 22 })}
              />
            </Box>

            <TextField
              label="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Authentication Method
              </Typography>
              <ToggleButtonGroup
                value={form.authMethod}
                exclusive
                onChange={(_, v) => v && setForm({ ...form, authMethod: v })}
                size="small"
                fullWidth
              >
                <ToggleButton value="password">
                  <LockRounded fontSize="small" sx={{ mr: 0.5 }} /> Password
                </ToggleButton>
                <ToggleButton value="key">
                  <VpnKeyRounded fontSize="small" sx={{ mr: 0.5 }} /> SSH Key
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {form.authMethod === "password" ? (
              <TextField
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
            ) : (
              <>
                <TextField
                  label="Private Key Path"
                  value={form.privateKeyPath}
                  onChange={(e) => setForm({ ...form, privateKeyPath: e.target.value })}
                  placeholder="~/.ssh/id_rsa"
                  helperText="Path to your private key file"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Browse file">
                          <IconButton
                            size="small"
                            onClick={async () => {
                              const selected = await openDialog({
                                title: "Select Private Key",
                                multiple: false,
                                directory: false,
                              });
                              if (selected) {
                                setForm({ ...form, privateKeyPath: selected as string });
                              }
                            }}
                          >
                            <FolderOpenRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Passphrase (optional)"
                  type="password"
                  value={form.privateKeyPassphrase}
                  onChange={(e) => setForm({ ...form, privateKeyPassphrase: e.target.value })}
                />
              </>
            )}
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Description"
              multiline
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is this server used for?"
            />

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Tags
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleTagAdd();
                    }
                  }}
                  placeholder="Add tag..."
                  sx={{ flex: 1 }}
                />
                <Button onClick={handleTagAdd} size="small" variant="outlined">
                  Add
                </Button>
              </Box>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {form.tags?.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={() => handleTagDelete(tag)}
                    icon={<TagRounded sx={{ fontSize: 14 }} />}
                  />
                ))}
                {(!form.tags || form.tags.length === 0) && (
                  <Typography variant="caption" color="text.secondary">
                    No tags added
                  </Typography>
                )}
              </Box>
            </Box>

            <Divider />
            <Box sx={{ p: 1.5, bgcolor: "#0d1117", borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Preview Connection
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace", mt: 0.5 }}>
                ssh {form.username}@{form.host || "[host]"} -p {form.port}
                {form.authMethod === "key" && form.privateKeyPath
                  ? ` -i ${form.privateKeyPath}`
                  : ""}
              </Typography>
            </Box>
          </Stack>
        )}

        {tab === 2 && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Default port forwards are automatically applied when you connect to this server.
            </Typography>

            {/* Direction toggle */}
            <ToggleButtonGroup
              value={fwdDir}
              exclusive
              onChange={(_, v) => v && setFwdDir(v)}
              size="small"
              fullWidth
            >
              <ToggleButton value="local">
                <AltRouteRounded fontSize="small" sx={{ mr: 0.5 }} /> Local → Remote
              </ToggleButton>
              <ToggleButton value="remote">
                <AltRouteRounded fontSize="small" sx={{ mr: 0.5 }} /> Remote → Local
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Add form */}
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <TextField
                size="small"
                label="Local Port"
                type="number"
                value={fwdForm.localPort}
                onChange={(e) => setFwdForm({ ...fwdForm, localPort: e.target.value })}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label="Remote Host"
                value={fwdForm.remoteHost}
                onChange={(e) => setFwdForm({ ...fwdForm, remoteHost: e.target.value })}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label="Remote Port"
                type="number"
                value={fwdForm.remotePort}
                onChange={(e) => setFwdForm({ ...fwdForm, remotePort: e.target.value })}
                sx={{ flex: 1 }}
              />
              <Button
                onClick={handleAddForward}
                variant="outlined"
                size="small"
                disabled={!fwdForm.localPort || !fwdForm.remotePort}
                startIcon={<AddRounded />}
                sx={{ whiteSpace: "nowrap" }}
              >
                Add
              </Button>
            </Box>

            {/* List */}
            <Box>
              {form.defaultForwards && form.defaultForwards.length > 0 ? (
                <Stack spacing={1}>
                  {form.defaultForwards.map((fwd, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        p: 1,
                        borderRadius: 1,
                        border: 1,
                        borderColor: "divider",
                      }}
                    >
                      <Chip
                        label={fwd.direction === "remote" ? "R → L" : "L → R"}
                        size="small"
                        color={fwd.direction === "remote" ? "warning" : "info"}
                        sx={{ fontSize: 10, height: 20 }}
                      />
                      <Typography variant="body2" sx={{ fontFamily: "monospace", flex: 1 }}>
                        {fwd.direction === "remote"
                          ? `${fwd.remoteHost}:${fwd.remotePort} → :${fwd.localPort}`
                          : `:${fwd.localPort} → ${fwd.remoteHost}:${fwd.remotePort}`}
                      </Typography>
                      <IconButton size="small" color="error" onClick={() => handleDeleteForward(idx)}>
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                  No default port forwards configured.
                </Typography>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>
      {testResult && (
        <Box sx={{ px: 3, pb: 0.5 }}>
          <Alert
            severity={testResult.ok ? "success" : "error"}
            icon={testResult.ok ? <CheckCircleRounded /> : <ErrorRounded />}
            onClose={() => setTestResult(null)}
            sx={{ fontSize: 12 }}
          >
            {testResult.message}
          </Alert>
        </Box>
      )}
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={handleTest}
          disabled={!form.host || !form.username || testing}
          startIcon={testing ? <CircularProgress size={14} /> : <PlagiarismRounded />}
          color="inherit"
        >
          {testing ? "Testing..." : "Test Connection"}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!form.name || !form.host}
        >
          {editServer ? "Update" : "Add Server"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
