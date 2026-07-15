import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Stack,
  Typography,
  Divider,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  DescriptionRounded,
  TagRounded,
  LockRounded,
  CloudRounded,
  PlagiarismRounded,
  CheckCircleRounded,
  ErrorRounded,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../stores/store";
import { generateId } from "../utils/id";
import type { MinioAsset } from "../types";

interface MinioDialogProps {
  open: boolean;
  onClose: () => void;
  editAsset?: MinioAsset | null;
}

export function MinioDialog({ open, onClose, editAsset }: MinioDialogProps) {
  const addMinioAsset = useStore((s) => s.addMinioAsset);
  const updateMinioAsset = useStore((s) => s.updateMinioAsset);

  const [form, setForm] = useState<MinioAsset>({
    id: "",
    name: "",
    endpoint: "",
    port: 9000,
    accessKey: "",
    secretKey: "",
    region: "us-east-1",
    useSSL: false,
    defaultBucket: "",
    group: "Default",
    tags: [],
    description: "",
  });
  const [tagInput, setTagInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (editAsset) {
      setForm(editAsset);
    } else {
      setForm({
        id: "",
        name: "",
        endpoint: "",
        port: 9000,
        accessKey: "",
        secretKey: "",
        region: "us-east-1",
        useSSL: false,
        defaultBucket: "",
        group: "Default",
        tags: [],
        description: "",
      });
    }
  }, [editAsset, open]);

  const handleSave = () => {
    if (!form.name || !form.endpoint) return;
    if (editAsset) {
      updateMinioAsset(editAsset.id, form);
    } else {
      addMinioAsset({ ...form, id: generateId("minio") });
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

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const buckets = await invoke<unknown[]>("minio_list_buckets", {
        config: {
          endpoint: form.endpoint,
          port: form.port,
          access_key: form.accessKey,
          secret_key: form.secretKey,
          region: form.region,
          use_ssl: form.useSSL,
        },
      });
      setTestResult({ ok: true, message: `Connected — ${buckets.length} bucket${buckets.length !== 1 ? "s" : ""} found` });
    } catch (e) {
      setTestResult({ ok: false, message: String(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
        <CloudRounded sx={{ fontSize: 20, color: "primary.main" }} />
        {editAsset ? "Edit MinIO Connection" : "Add MinIO Connection"}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              label="Name"
              required
              fullWidth
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="My MinIO"
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
              label="Endpoint"
              required
              fullWidth
              value={form.endpoint}
              onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
              placeholder="192.168.1.100"
              helperText="Hostname or IP (no scheme)"
            />
            <TextField
              label="Port"
              type="number"
              sx={{ width: 100 }}
              value={form.port}
              onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 9000 })}
            />
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Connection Protocol
            </Typography>
            <ToggleButtonGroup
              value={form.useSSL ? "ssl" : "plain"}
              exclusive
              onChange={(_, v) => v && setForm({ ...form, useSSL: v === "ssl" })}
              size="small"
              fullWidth
            >
              <ToggleButton value="plain">HTTP</ToggleButton>
              <ToggleButton value="ssl">HTTPS (SSL)</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              label="Access Key"
              required
              fullWidth
              value={form.accessKey}
              onChange={(e) => setForm({ ...form, accessKey: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockRounded sx={{ fontSize: 16 }} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Secret Key"
              required
              fullWidth
              type="password"
              value={form.secretKey}
              onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
            />
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              label="Region"
              sx={{ width: 180 }}
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              placeholder="us-east-1"
            />
            <TextField
              label="Default Bucket (optional)"
              fullWidth
              value={form.defaultBucket}
              onChange={(e) => setForm({ ...form, defaultBucket: e.target.value })}
              placeholder="my-bucket"
            />
          </Box>

          <Divider />

          <TextField
            label="Description"
            multiline
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What is this MinIO used for?"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 1 }}>
                  <DescriptionRounded sx={{ fontSize: 16 }} />
                </InputAdornment>
              ),
            }}
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
                  onDelete={() => setForm({ ...form, tags: form.tags?.filter((t) => t !== tag) })}
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
          <Box sx={{ p: 1.5, bgcolor: "background.default", borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Preview Endpoint
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: "monospace", mt: 0.5 }}>
              {form.useSSL ? "https" : "http"}://{form.endpoint || "[endpoint]"}:{form.port}
              {form.defaultBucket ? `/${form.defaultBucket}` : ""}
            </Typography>
          </Box>
        </Stack>
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
          disabled={!form.endpoint || !form.accessKey || !form.secretKey || testing}
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
          disabled={!form.name || !form.endpoint || !form.accessKey || !form.secretKey}
        >
          {editAsset ? "Update" : "Add Connection"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
