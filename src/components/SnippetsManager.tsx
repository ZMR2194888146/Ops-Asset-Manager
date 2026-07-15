import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Menu,
  MenuItem,
  Stack,
} from "@mui/material";
import {
  AddRounded,
  EditRounded,
  DeleteRounded,
  MoreVertRounded,
  CodeRounded,
  CategoryRounded,
} from "@mui/icons-material";
import { useStore } from "../stores/store";
import { generateId } from "../utils/id";
import type { Snippet } from "../types";

export function SnippetsManager() {
  const snippets = useStore((s) => s.snippets);
  const addSnippet = useStore((s) => s.addSnippet);
  const updateSnippet = useStore((s) => s.updateSnippet);
  const deleteSnippet = useStore((s) => s.deleteSnippet);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Snippet | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuSnip, setMenuSnip] = useState<Snippet | null>(null);

  const categories = [...new Set(snippets.map((s) => s.category).filter(Boolean))] as string[];

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Snippets</Typography>
          <Typography variant="caption" color="text.secondary">Reusable commands for quick execution</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => { setEditTarget(null); setDialogOpen(true); }}>
          Add Snippet
        </Button>
      </Box>

      {categories.length === 0 ? (
        <Card sx={{ textAlign: "center", py: 5 }}>
          <Typography variant="subtitle1" color="text.secondary">No snippets yet</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>Create reusable command snippets</Typography>
        </Card>
      ) : (
        categories.map((cat) => (
          <Box key={cat} sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10.5, display: "flex", alignItems: "center", gap: 0.5 }}>
              <CategoryRounded sx={{ fontSize: 13 }} /> {cat}
            </Typography>
            <Grid container spacing={1.5}>
              {snippets.filter((s) => s.category === cat).map((snippet) => (
                <Grid item xs={12} sm={6} md={4} key={snippet.id}>
                  <Card sx={{ "&:hover": { borderColor: "primary.dark" } }}>
                    <CardContent>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: 12.5 }}>{snippet.name}</Typography>
                          {snippet.description && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>{snippet.description}</Typography>}
                        </Box>
                        <IconButton sx={{ p: 0.25 }} onClick={(e) => { setMenuAnchor(e.currentTarget); setMenuSnip(snippet); }}>
                          <MoreVertRounded sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Box>
                      <Box sx={{ mt: 0.75, p: 0.75, bgcolor: "#0d1117", borderRadius: 1, border: "1px solid #21262d", fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: "#7ee787", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        <CodeRounded sx={{ fontSize: 12, mr: 0.25, verticalAlign: "middle", opacity: 0.5 }} />
                        {snippet.command}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => { setMenuAnchor(null); setMenuSnip(null); }}>
        <MenuItem onClick={() => { if (menuSnip) { setEditTarget(menuSnip); setDialogOpen(true); } setMenuAnchor(null); }}>
          <EditRounded fontSize="small" sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => { if (menuSnip) deleteSnippet(menuSnip.id); setMenuAnchor(null); }} sx={{ color: "error.main" }}>
          <DeleteRounded fontSize="small" sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      <SnippetDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSave={(snippet) => {
        if (editTarget) updateSnippet(editTarget.id, snippet);
        else addSnippet({ ...snippet, id: generateId("snip") });
        setDialogOpen(false);
      }} editTarget={editTarget} />
    </Box>
  );
}

function SnippetDialog({ open, onClose, onSave, editTarget }: { open: boolean; onClose: () => void; onSave: (s: Snippet) => void; editTarget: Snippet | null }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth key={`${open}-${editTarget?.id || "new"}`}>
      <SnippetForm editTarget={editTarget} onSave={onSave} onClose={onClose} />
    </Dialog>
  );
}

function SnippetForm({ editTarget, onSave, onClose }: { editTarget: Snippet | null; onSave: (s: Snippet) => void; onClose: () => void }) {
  const [form, setForm] = useState<Snippet>(editTarget || { id: "", name: "", command: "", description: "", category: "System" });

  return (
    <>
      <DialogTitle>{editTarget ? "Edit Snippet" : "Add Snippet"}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField label="Name" required fullWidth value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField label="Category" sx={{ width: 140 }} value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Box>
          <TextField label="Command" required fullWidth multiline rows={2} value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} sx={{ "& .MuiOutlinedInput-root": { fontFamily: "monospace", fontSize: 12 } }} placeholder="docker logs -f container_name" />
          <TextField label="Description" fullWidth value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button variant="contained" onClick={() => form.name && form.command && onSave(form)} disabled={!form.name || !form.command}>
          {editTarget ? "Update" : "Add"}
        </Button>
      </DialogActions>
    </>
  );
}
