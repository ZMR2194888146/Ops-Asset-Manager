import { useMemo } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import ReactDOM from "react-dom/client";
import App from "./App";
import { buildTheme } from "./theme/theme";
import { getThemePreset } from "./theme/presets";
import { useStore } from "./stores/store";

function Root() {
  const themeId = useStore((s) => s.settings.themeId);
  const theme = useMemo(() => {
    const preset = getThemePreset(themeId);
    return buildTheme(preset);
  }, [themeId]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);
