import { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  LinearProgress,
  Stack,
  Tooltip,
  IconButton,
} from "@mui/material";
import {
  RefreshRounded,
  MemoryRounded,
  StorageRounded,
  NetworkCheckRounded,
  ScheduleRounded,
  DeveloperBoardRounded,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import { getThemePreset } from "../theme/presets";
import { useStore } from "../stores/store";

interface ServerStats {
  cpu_usage: number;
  cpu_cores: number;
  mem_total: number;
  mem_used: number;
  mem_free: number;
  swap_total: number;
  swap_used: number;
  disk_total: number;
  disk_used: number;
  disk_free: number;
  net_rx_bytes: number;
  net_tx_bytes: number;
  uptime_seconds: number;
  load_avg_1: number;
  load_avg_5: number;
  load_avg_15: number;
  processes: number;
  hostname: string;
  os_info: string;
  kernel: string;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function fmtKB(kb: number): string {
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(0)} MB`;
  return `${(kb / 1024 / 1024).toFixed(1)} GB`;
}

function fmtUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface SparklineProps {
  data: number[];
  max: number;
  color: string;
  height?: number;
}

function Sparkline({ data, max, color, height = 32 }: SparklineProps) {
  if (data.length < 2) return <Box sx={{ height }} />;
  const w = 100;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = height - (Math.min(v, max) / max) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = `0,${height} ${points} ${w},${height}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace("#", "")})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  percent?: number;
  color: string;
  sparklineData?: number[];
}

function StatCard({ icon, label, value, subValue, percent, color, sparklineData }: StatCardProps) {
  return (
    <Box sx={{ p: 1, borderRadius: 1, bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
        <Box sx={{ color }}>{icon}</Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, fontWeight: 600, flex: 1 }}>{label}</Typography>
        {percent !== undefined && (
          <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 700, color }}>{percent.toFixed(1)}%</Typography>
        )}
      </Stack>
      {percent !== undefined ? (
        <>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{value}</Typography>
          {subValue && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9.5 }}>{subValue}</Typography>}
          <LinearProgress
            variant="determinate"
            value={Math.min(percent, 100)}
            sx={{
              mt: 0.5,
              height: 4,
              borderRadius: 2,
              bgcolor: "divider",
              "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 2 },
            }}
          />
          {sparklineData && sparklineData.length > 1 && (
            <Box sx={{ mt: 0.5 }}>
              <Sparkline data={sparklineData} max={100} color={color} />
            </Box>
          )}
        </>
      ) : (
        <>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{value}</Typography>
          {subValue && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9.5 }}>{subValue}</Typography>}
          {sparklineData && sparklineData.length > 1 && (
            <Box sx={{ mt: 0.25 }}>
              <Sparkline data={sparklineData} max={Math.max(...sparklineData, 1)} color={color} />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

export function ServerStatsPanel({ sessionId }: { sessionId: string }) {
  const themeId = useStore((s) => s.settings.themeId);
  const preset = getThemePreset(themeId);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cpuHistory = useRef<number[]>([]);
  const memHistory = useRef<number[]>([]);
  const netRxHistory = useRef<number[]>([]);
  const netTxHistory = useRef<number[]>([]);
  const prevNetRx = useRef<number>(0);
  const prevNetTx = useRef<number>(0);

  const fetchStats = async () => {
    try {
      const result = await invoke<ServerStats>("server_stats", { sessionId });
      setStats(result);
      setError("");

      cpuHistory.current = [...cpuHistory.current, result.cpu_usage].slice(-30);
      const memPct = result.mem_total > 0 ? (result.mem_used / result.mem_total) * 100 : 0;
      memHistory.current = [...memHistory.current, memPct].slice(-30);

      const rxDelta = prevNetRx.current > 0 ? result.net_rx_bytes - prevNetRx.current : 0;
      const txDelta = prevNetTx.current > 0 ? result.net_tx_bytes - prevNetTx.current : 0;
      netRxHistory.current = [...netRxHistory.current, rxDelta].slice(-30);
      netTxHistory.current = [...netTxHistory.current, txDelta].slice(-30);
      prevNetRx.current = result.net_rx_bytes;
      prevNetTx.current = result.net_tx_bytes;
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    cpuHistory.current = [];
    memHistory.current = [];
    netRxHistory.current = [];
    netTxHistory.current = [];
    prevNetRx.current = 0;
    prevNetTx.current = 0;
    fetchStats();
    timerRef.current = setInterval(fetchStats, 3000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const memPct = stats && stats.mem_total > 0 ? (stats.mem_used / stats.mem_total) * 100 : 0;
  const swapPct = stats && stats.swap_total > 0 ? (stats.swap_used / stats.swap_total) * 100 : 0;
  const diskPct = stats && stats.disk_total > 0 ? (stats.disk_used / stats.disk_total) * 100 : 0;

  const curRxSpeed = netRxHistory.current.length > 1 ? netRxHistory.current[netRxHistory.current.length - 1] : 0;
  const curTxSpeed = netTxHistory.current.length > 1 ? netTxHistory.current[netTxHistory.current.length - 1] : 0;

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" sx={{ px: 1, py: 0.5, borderBottom: `1px solid ${preset.divider}`, flexShrink: 0 }}>
        <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: preset.primary, flex: 1 }}>
          Server Monitor
        </Typography>
        <Tooltip title="Refresh">
          <IconButton sx={{ p: 0.25 }} onClick={fetchStats} disabled={loading}>
            {loading ? <CircularProgress size={12} /> : <RefreshRounded sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
      </Stack>

      {error ? (
        <Box sx={{ p: 2, textAlign: "center" }}>
          <Typography variant="caption" color="error" sx={{ fontSize: 11 }}>{error}</Typography>
        </Box>
      ) : !stats ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={20} /></Box>
      ) : (
        <Box sx={{ flex: 1, overflow: "auto", p: 0.75 }}>
          {/* System info */}
          <Box sx={{ mb: 0.75, p: 0.75, borderRadius: 1, bgcolor: preset.background.default, border: `1px solid ${preset.divider}` }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: preset.text.primary }}>{stats.hostname}</Typography>
            <Typography variant="caption" sx={{ fontSize: 9.5, color: preset.text.secondary }}>
              {stats.os_info} · kernel {stats.kernel}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.25 }}>
              <Stack direction="row" spacing={0.25} alignItems="center">
                <ScheduleRounded sx={{ fontSize: 11, color: preset.text.secondary }} />
                <Typography variant="caption" sx={{ fontSize: 9.5, color: preset.text.secondary }}>{fmtUptime(stats.uptime_seconds)}</Typography>
              </Stack>
              <Typography variant="caption" sx={{ fontSize: 9.5, color: preset.text.secondary }}>·</Typography>
              <Typography variant="caption" sx={{ fontSize: 9.5, color: preset.text.secondary }}>{stats.processes} procs</Typography>
            </Stack>
          </Box>

          {/* CPU */}
          <Box sx={{ mb: 0.75 }}>
            <StatCard
              icon={<DeveloperBoardRounded sx={{ fontSize: 14 }} />}
              label="CPU"
              value={`${stats.cpu_usage.toFixed(1)}%`}
              subValue={`${stats.cpu_cores} cores · load ${stats.load_avg_1.toFixed(2)}`}
              percent={stats.cpu_usage}
              color={preset.primary}
              sparklineData={cpuHistory.current}
            />
          </Box>

          {/* Memory */}
          <Box sx={{ mb: 0.75 }}>
            <StatCard
              icon={<MemoryRounded sx={{ fontSize: 14 }} />}
              label="Memory"
              value={`${fmtKB(stats.mem_used)} / ${fmtKB(stats.mem_total)}`}
              subValue={swapPct > 0 ? `Swap: ${fmtKB(stats.swap_used)} / ${fmtKB(stats.swap_total)} (${swapPct.toFixed(0)}%)` : "No swap"}
              percent={memPct}
              color={preset.terminal.magenta}
              sparklineData={memHistory.current}
            />
          </Box>

          {/* Disk */}
          <Box sx={{ mb: 0.75 }}>
            <StatCard
              icon={<StorageRounded sx={{ fontSize: 14 }} />}
              label="Disk /"
              value={`${fmtBytes(stats.disk_used)} / ${fmtBytes(stats.disk_total)}`}
              subValue={`${fmtBytes(stats.disk_free)} free`}
              percent={diskPct}
              color={preset.warning}
            />
          </Box>

          {/* Network */}
          <Box>
            <StatCard
              icon={<NetworkCheckRounded sx={{ fontSize: 14 }} />}
              label="Network"
              value={`↓ ${fmtBytes(curRxSpeed)}  ↑ ${fmtBytes(curTxSpeed)}`}
              subValue={`Total: ↓ ${fmtBytes(stats.net_rx_bytes)} ↑ ${fmtBytes(stats.net_tx_bytes)}`}
              color={preset.success}
              sparklineData={netRxHistory.current}
            />
            {netTxHistory.current.length > 1 && (
              <Box sx={{ mt: 0.25 }}>
                <Sparkline data={netTxHistory.current} max={Math.max(...netTxHistory.current, 1)} color={preset.terminal.cyan} />
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
