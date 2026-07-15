import { createTheme } from "@mui/material/styles";
import type { ThemePreset } from "./presets";

export function buildTheme(preset: ThemePreset) {
  return createTheme({
    palette: {
      mode: preset.mode,
      primary: {
        main: preset.primary,
        light: preset.primaryLight,
        dark: preset.primaryDark,
        contrastText: preset.mode === "dark" ? "#ffffff" : "#ffffff",
      },
      secondary: {
        main: preset.secondary,
      },
      background: {
        default: preset.background.default,
        paper: preset.background.paper,
      },
      success: { main: preset.success },
      warning: { main: preset.warning },
      error: { main: preset.error },
      text: {
        primary: preset.text.primary,
        secondary: preset.text.secondary,
      },
      divider: preset.divider,
    },
    typography: {
      fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 13,
      h5: { fontWeight: 600, fontSize: 18 },
      h6: { fontWeight: 600, fontSize: 15 },
      subtitle1: { fontWeight: 500, fontSize: 13 },
      subtitle2: { fontWeight: 600, fontSize: 12 },
      body1: { fontSize: 13 },
      body2: { fontSize: 12 },
      caption: { fontSize: 11 },
      button: { textTransform: "none", fontWeight: 500, fontSize: 13 },
    },
    shape: { borderRadius: 8 },
    spacing: 6,
    components: {
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: "none" } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, size: "small" },
        styleOverrides: {
          root: { padding: "4px 12px", minHeight: 30 },
          containedPrimary: {
            background: `linear-gradient(135deg, ${preset.primary} 0%, ${preset.primaryDark} 100%)`,
            "&:hover": { background: `linear-gradient(135deg, ${preset.primaryLight} 0%, ${preset.primary} 100%)` },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { background: preset.background.paper, border: `1px solid ${preset.divider}`, backgroundImage: "none" },
        },
      },
      MuiCardContent: {
        styleOverrides: { root: { padding: "10px 12px", "&:last-child": { paddingBottom: "10px" } } },
      },
      MuiTextField: { defaultProps: { variant: "outlined", size: "small" } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            fontSize: 13,
            "& .MuiOutlinedInput-input": { padding: "7px 10px" },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: preset.primary },
          },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { fontSize: 13 } } },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 500, height: 22, fontSize: 11 }, sizeSmall: { height: 18, fontSize: 10 } },
      },
      MuiListItemButton: {
        styleOverrides: { root: { borderRadius: 6, margin: "1px 6px", padding: "3px 10px", fontSize: 12.5 } },
      },
      MuiListItem: { styleOverrides: { root: { paddingTop: 1, paddingBottom: 1 } } },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 32 } } },
      MuiListItemText: { styleOverrides: { root: { margin: 0 } } },
      MuiDialog: {
        styleOverrides: { paper: { background: preset.background.paper, border: `1px solid ${preset.divider}` } },
      },
      MuiDialogTitle: { styleOverrides: { root: { padding: "12px 16px", fontSize: 15, fontWeight: 600 } } },
      MuiDialogContent: { styleOverrides: { root: { padding: "8px 16px" } } },
      MuiDialogActions: { styleOverrides: { root: { padding: "8px 16px 12px" } } },
      MuiTooltip: { styleOverrides: { tooltip: { fontSize: 11, background: preset.divider, padding: "4px 8px" } } },
      MuiTabs: { styleOverrides: { root: { minHeight: 36 } } },
      MuiTab: { styleOverrides: { root: { minHeight: 36, textTransform: "none", fontSize: 12.5, padding: "4px 12px" } } },
      MuiToggleButton: { styleOverrides: { root: { fontSize: 12, padding: "3px 10px" } } },
      MuiSlider: { styleOverrides: { root: { padding: "8px 0" } } },
      MuiIconButton: { defaultProps: { size: "small" } },
      MuiTableCell: { styleOverrides: { root: { padding: "4px 8px", fontSize: 12 } } },
      MuiMenuItem: { styleOverrides: { root: { fontSize: 12.5, padding: "4px 12px" } } },
      MuiAlert: { styleOverrides: { root: { fontSize: 12, padding: "4px 12px" } } },
      MuiDivider: { styleOverrides: { root: { borderColor: preset.divider } } },
      MuiDrawer: {
        styleOverrides: {
          paper: { background: preset.background.default, borderRight: `1px solid ${preset.divider}` },
        },
      },
      MuiTableRow: { styleOverrides: { root: { "&.Mui-selected": { backgroundColor: `${preset.primary}1a` } } } },
    },
  });
}
