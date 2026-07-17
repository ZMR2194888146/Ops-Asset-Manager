import { useState, useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { Sidebar } from "./components/Sidebar";
import { AssetManager } from "./components/AssetManager";
import { TerminalView } from "./components/TerminalView";
import { SnippetsManager } from "./components/SnippetsManager";
import { SettingsView } from "./components/SettingsView";
import { ServerDialog } from "./components/ServerDialog";
import { MinioDialog } from "./components/MinioDialog";
import { useStore } from "./stores/store";
import type { ViewType } from "./types";

function App() {
  const view = useStore((s) => s.view);
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [minioDialogOpen, setMinioDialogOpen] = useState(false);
  const setConfigFilePath = useStore((s) => s.setConfigFilePath);
  const loadConfigFromFile = useStore((s) => s.loadConfigFromFile);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const VIEWS: ViewType[] = ["assets", "terminal", "snippets", "settings"];

  // On startup: read config path from ~/.new-rsm/meta.json, then load config
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        const path = await invoke<string>("get_config_path");
        setConfigFilePath(path);
      } catch (e) {
        console.error("Failed to get config path:", e);
        return;
      }
      loadConfigFromFile().catch((e) =>
        console.error("Failed to load config from file:", e)
      );
    })();
  }, [setConfigFilePath, loadConfigFromFile]);

  // Restore window size from saved settings on startup
  useEffect(() => {
    const settings = useStore.getState().settings;
    const win = getCurrentWindow();
    win.setSize(new LogicalSize(settings.windowWidth, settings.windowHeight)).catch(() => {});
  }, []);

  // Save window size on resize (debounced)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unlisten: (() => void) | null = null;

    const win = getCurrentWindow();
    win.onResized(async () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const size = await win.outerSize();
          const factor = await win.scaleFactor();
          const w = Math.round(size.width / factor);
          const h = Math.round(size.height / factor);
          if (w > 0 && h > 0) {
            useStore.getState().updateSettings({ windowWidth: w, windowHeight: h });
          }
        } catch {}
      }, 500);
    }).then((fn) => { unlisten = fn; });

    return () => {
      if (timer) clearTimeout(timer);
      if (unlisten) unlisten();
    };
  }, []);

  // Auto-save to config file when assets change (debounced)
  useEffect(() => {
    const snapshot = () =>
      JSON.stringify({
        s: useStore.getState().servers,
        m: useStore.getState().minioAssets,
        n: useStore.getState().snippets,
        p: useStore.getState().portForwards,
        st: useStore.getState().settings,
      });

    let prev = snapshot();

    const unsubscribe = useStore.subscribe(() => {
      const next = snapshot();
      if (next === prev) return;
      prev = next;

      const filePath = useStore.getState().configFilePath;
      if (!filePath) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        useStore.getState().saveConfigToFile().catch((e) =>
          console.error("Auto-save config failed:", e)
        );
      }, 500);
    });

    return () => {
      unsubscribe();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar
        onAddServer={() => setServerDialogOpen(true)}
        onAddMinio={() => setMinioDialogOpen(true)}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {VIEWS.map((v) => (
          <Box
            key={v}
            sx={{
              flex: 1,
              overflow: v === "terminal" ? "hidden" : "auto",
              display: view === v ? "flex" : "none",
              flexDirection: "column",
            }}
          >
            {v === "assets" && <AssetManager />}
            {v === "terminal" && <TerminalView />}
            {v === "snippets" && <SnippetsManager />}
            {v === "settings" && <SettingsView />}
          </Box>
        ))}
      </Box>

      <ServerDialog open={serverDialogOpen} onClose={() => setServerDialogOpen(false)} />
      <MinioDialog open={minioDialogOpen} onClose={() => setMinioDialogOpen(false)} />
    </Box>
  );
}

export default App;
