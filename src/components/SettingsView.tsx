import { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Stack,
  Slider,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  InputAdornment,
  Tooltip,
} from "@mui/material";
import {
  DownloadRounded,
  TerminalRounded,
  TextFieldsRounded,
  HistoryRounded,
  CheckRounded,
  PaletteRounded,
  FolderOpenRounded,
  SaveRounded,
  UploadFileRounded,
  LinkRounded,
  LinkOffRounded,
  AutoAwesomeRounded,
  VpnKeyRounded,
  DnsRounded,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useStore } from "../stores/store";
import { THEME_PRESETS } from "../theme/presets";

export function SettingsView() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const ai = useStore((s) => s.ai);
  const updateAi = useStore((s) => s.updateAi);
  const exportConfig = useStore((s) => s.exportConfig);
  const exportSshConfig = useStore((s) => s.exportSshConfig);
  const configFilePath = useStore((s) => s.configFilePath);
  const setConfigFilePath = useStore((s) => s.setConfigFilePath);
  const loadConfigFromFile = useStore((s) => s.loadConfigFromFile);
  const saveConfigToFile = useStore((s) => s.saveConfigToFile);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });

  const handleExport = async (format: "json" | "ssh") => {
    const data = format === "json" ? exportConfig() : exportSshConfig();
    try { await invoke("export_config", { data, format }); setSnackbar({ open: true, message: "Export successful!", severity: "success" }); }
    catch (e) { if (String(e) !== "Export cancelled") setSnackbar({ open: true, message: `Export failed: ${e}`, severity: "error" }); }
  };

  const handleChooseFile = async () => {
    const path = await openDialog({
      filters: [{ name: "JSON", extensions: ["json"] }],
      multiple: false,
    });
    if (path) {
      setConfigFilePath(path as string);
      await invoke("set_config_path", { path });
      setSnackbar({ open: true, message: "Config file path set", severity: "success" });
    }
  };

  const handleChooseNewFile = async () => {
    const path = await saveDialog({
      filters: [{ name: "JSON", extensions: ["json"] }],
      defaultPath: "rsm-config.json",
    });
    if (path) {
      setConfigFilePath(path as string);
      await invoke("set_config_path", { path });
      setSnackbar({ open: true, message: "New config file path set. Click Save to write.", severity: "success" });
    }
  };

  const handleLoad = async () => {
    try {
      await loadConfigFromFile();
      setSnackbar({ open: true, message: "Config loaded from file!", severity: "success" });
    } catch (e) {
      setSnackbar({ open: true, message: `Load failed: ${e}`, severity: "error" });
    }
  };

  const handleSave = async () => {
    try {
      await saveConfigToFile();
      setSnackbar({ open: true, message: "Config saved to file!", severity: "success" });
    } catch (e) {
      setSnackbar({ open: true, message: `Save failed: ${e}`, severity: "error" });
    }
  };

  const handleUnlink = async () => {
    setConfigFilePath(null);
    await invoke("set_config_path", { path: "" });
    setSnackbar({ open: true, message: "Config file unlinked. Using local storage.", severity: "success" });
  };

  return (
    <Box sx={{ p: 2, maxWidth: 700 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1.5 }}>Settings</Typography>

      {/* Theme selection */}
      <Card sx={{ mb: 1.5 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, fontSize: 14, display: "flex", alignItems: "center", gap: 0.5 }}>
            <PaletteRounded sx={{ fontSize: 16 }} /> Theme
          </Typography>
          <Grid container spacing={1}>
            {THEME_PRESETS.map((preset) => (
              <Grid item xs={6} sm={4} key={preset.id}>
                <Box
                  onClick={() => updateSettings({ themeId: preset.id })}
                  sx={{
                    cursor: "pointer",
                    borderRadius: 1.5,
                    border: settings.themeId === preset.id ? 2 : 1,
                    borderColor: settings.themeId === preset.id ? "primary.main" : "divider",
                    overflow: "hidden",
                    transition: "all 0.15s",
                    "&:hover": { borderColor: "primary.light", transform: "translateY(-1px)" },
                  }}
                >
                  {/* Preview bar */}
                  <Box sx={{ display: "flex", height: 24 }}>
                    <Box sx={{ flex: 1, bgcolor: preset.terminal.background, display: "flex", alignItems: "center", pl: 0.75, gap: 0.25 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: preset.terminal.red }} />
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: preset.terminal.yellow }} />
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: preset.terminal.green }} />
                    </Box>
                  </Box>
                  {/* Content preview */}
                  <Box sx={{ p: 1, bgcolor: preset.background.paper }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 600, color: preset.text.primary }}>{preset.name}</Typography>
                      {settings.themeId === preset.id && (
                        <CheckRounded sx={{ fontSize: 14, color: preset.primary }} />
                      )}
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5, mt: 0.5 }}>
                      <Box sx={{ width: 18, height: 5, borderRadius: 1, bgcolor: preset.primary }} />
                      <Box sx={{ width: 18, height: 5, borderRadius: 1, bgcolor: preset.secondary }} />
                      <Box sx={{ width: 18, height: 5, borderRadius: 1, bgcolor: preset.success }} />
                      <Box sx={{ width: 18, height: 5, borderRadius: 1, bgcolor: preset.terminal.yellow }} />
                      <Box sx={{ width: 18, height: 5, borderRadius: 1, bgcolor: preset.error }} />
                    </Box>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Terminal settings */}
      <Card sx={{ mb: 1.5 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, fontSize: 14 }}>Terminal</Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 0.5, fontSize: 12 }}>
                <TextFieldsRounded sx={{ fontSize: 15 }} /> Font Size: {settings.fontSize}px
              </Typography>
              <Slider value={settings.fontSize} onChange={(_, v) => updateSettings({ fontSize: v as number })} min={10} max={24} step={1} marks valueLabelDisplay="auto" />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 0.5, fontSize: 12 }}>
                <HistoryRounded sx={{ fontSize: 15 }} /> Scrollback: {settings.scrollback} lines
              </Typography>
              <Slider value={settings.scrollback} onChange={(_, v) => updateSettings({ scrollback: v as number })} min={1000} max={50000} step={1000} valueLabelDisplay="auto" />
            </Box>
            <TextField label="Default Shell" value={settings.defaultShell} onChange={(e) => updateSettings({ defaultShell: e.target.value })} sx={{ maxWidth: 280 }} helperText="Shell to request on new connections" />
          </Stack>
        </CardContent>
      </Card>

      {/* AI configuration */}
      <Card sx={{ mb: 1.5 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5, fontSize: 14, display: "flex", alignItems: "center", gap: 0.5 }}>
            <AutoAwesomeRounded sx={{ fontSize: 16 }} /> AI Configuration
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            Configure the AI provider for command generation in the terminal. Used when you type <code>{">"}</code> in the input bar.
          </Typography>

          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: 12 }}>Provider</Typography>
              <ToggleButtonGroup
                value={ai.provider}
                exclusive
                onChange={(_, v) => {
                  if (!v) return;
                  const defaults: Record<string, { baseUrl: string; model: string }> = {
                    openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
                    anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-20250514" },
                    ollama: { baseUrl: "http://localhost:11434", model: "llama3" },
                    custom: { baseUrl: "", model: "" },
                  };
                  const d = defaults[v];
                  updateAi({ provider: v, baseUrl: d.baseUrl, model: d.model });
                }}
                size="small"
                fullWidth
              >
                <ToggleButton value="openai">OpenAI</ToggleButton>
                <ToggleButton value="anthropic">Anthropic</ToggleButton>
                <ToggleButton value="ollama">Ollama</ToggleButton>
                <ToggleButton value="custom">Custom</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <TextField
              label="API Key"
              type="password"
              fullWidth
              value={ai.apiKey}
              onChange={(e) => updateAi({ apiKey: e.target.value })}
              placeholder={ai.provider === "ollama" ? "Not required for Ollama" : "sk-..."}
              disabled={ai.provider === "ollama"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <VpnKeyRounded sx={{ fontSize: 16 }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Base URL"
              fullWidth
              value={ai.baseUrl}
              onChange={(e) => updateAi({ baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
              helperText={ai.provider === "ollama" ? "Ollama server address" : "API endpoint (leave default for known providers)"}
            />

            <TextField
              label="Model"
              fullWidth
              value={ai.model}
              onChange={(e) => updateAi({ model: e.target.value })}
              placeholder="gpt-4o-mini"
              helperText="Model name to use for completions"
            />

            {ai.provider !== "ollama" && !ai.apiKey && (
              <Alert severity="warning" sx={{ fontSize: 11 }}>
                API key is required for {ai.provider}. The AI command feature will fall back to local pattern matching without it.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Config file location */}
      <Card sx={{ mb: 1.5 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5, fontSize: 14, display: "flex", alignItems: "center", gap: 0.5 }}>
            <LinkRounded sx={{ fontSize: 16 }} /> Config File Location
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            Save your servers, snippets, port forwards, and settings to a custom file. The app loads from this file on startup.
          </Typography>

          {configFilePath ? (
            <Stack spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                value={configFilePath}
                inputProps={{ readOnly: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <FolderOpenRounded sx={{ fontSize: 16, color: "primary.main" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <Tooltip title="Unlink file (revert to local storage)">
                      <Button size="small" onClick={handleUnlink} sx={{ minWidth: "auto", p: 0.25 }}>
                        <LinkOffRounded sx={{ fontSize: 16 }} />
                      </Button>
                    </Tooltip>
                  ),
                }}
                sx={{ "& .MuiOutlinedInput-input": { fontFamily: "monospace", fontSize: 12 } }}
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" size="small" startIcon={<SaveRounded />} onClick={handleSave}>Save Now</Button>
                <Button variant="outlined" size="small" startIcon={<UploadFileRounded />} onClick={handleLoad}>Load from File</Button>
                <Button variant="outlined" size="small" startIcon={<FolderOpenRounded />} onClick={handleChooseFile}>Change File</Button>
              </Stack>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" startIcon={<FolderOpenRounded />} onClick={handleChooseFile}>Open Existing File</Button>
              <Button variant="outlined" size="small" startIcon={<SaveRounded />} onClick={handleChooseNewFile}>Create New File</Button>
            </Stack>
          )}

          {configFilePath && (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              Config auto-saves to this file on every change. Default location: <code>~/.new-rsm/config.json</code>.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Config export */}
      <Card sx={{ mb: 1.5 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, fontSize: 14 }}>Configuration Export</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            Export server configs for backup or use with standard SSH tools.
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => handleExport("json")}>Export JSON</Button>
            <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => handleExport("ssh")}>Export SSH Config</Button>
          </Stack>
          <Alert severity="info" sx={{ mt: 1.5 }}>
            SSH Config generates a standard <code>~/.ssh/config</code> file. JSON includes all data.
          </Alert>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5, fontSize: 14 }}>About</Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><TerminalRounded sx={{ fontSize: 16 }} /></ListItemIcon>
              <ListItemText primary="RSM - Remote SSH Manager" secondary="v0.1.0" primaryTypographyProps={{ fontSize: 12.5 }} secondaryTypographyProps={{ fontSize: 11 }} />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckRounded sx={{ fontSize: 16 }} /></ListItemIcon>
              <ListItemText primary="Tech Stack" secondary="Tauri v2 + React + Rust + xterm.js" primaryTypographyProps={{ fontSize: 12.5 }} secondaryTypographyProps={{ fontSize: 11 }} />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
