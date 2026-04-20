"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, Play, Pause,
  RefreshCw, Images, User as UserIcon, Shield, Clock,
  Zap, BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

interface PendingItem {
  kind: "profile" | "gallery";
  profileId: string;
  galleryId?: string;
  sourceUrl: string;
}

interface PendingProfile {
  profileId: string;
  fullName: string;
  email: string;
  items: PendingItem[];
}

interface Snapshot {
  pending: PendingProfile[];
  alreadyMigrated: number;
  total: number;
}

type ItemStatus = "queued" | "uploading" | "done" | "failed" | "skipped";

interface ItemLog {
  key: string;
  profileName: string;
  kind: "profile" | "gallery";
  status: ItemStatus;
  message?: string;
  durationMs?: number;
  retries?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;

// ─── Component ────────────────────────────────────────────────────────────

export function BackfillClient() {
  const { toast } = useToast();

  const [snapshot, setSnapshot]       = useState<Snapshot | null>(null);
  const [loading, setLoading]         = useState(true);
  const [running, setRunning]         = useState(false);
  const [paused, setPaused]           = useState(false);
  const [logs, setLogs]               = useState<ItemLog[]>([]);
  const [startedAt, setStartedAt]     = useState<number | null>(null);
  const [showTelemetry, setShowTelemetry] = useState(false);

  const pausedRef      = useRef(paused);
  const runningRef     = useRef(running);
  const logsEndRef     = useRef<HTMLDivElement>(null);
  const activeItemRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { runningRef.current = running; }, [running]);

  // Auto-scroll to active item
  useEffect(() => {
    if (running && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [logs, running]);

  // ── Snapshot loader ───────────────────────────────────────────────────

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/backfill/cloudinary", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setSnapshot(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      toast({ title: "Couldn't load backfill status", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadSnapshot(); }, [loadSnapshot]);

  // ── Per-log updater ───────────────────────────────────────────────────

  const patchLog = useCallback((key: string, patch: Partial<ItemLog>) => {
    setLogs((prev) => prev.map((l) => l.key === key ? { ...l, ...patch } : l));
  }, []);

  // ── Process ONE item with retries ─────────────────────────────────────

  async function processItem(item: PendingItem, profileName: string, key: string): Promise<void> {
    const itemStart = Date.now();
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      if (attempt > 0) {
        patchLog(key, { status: "uploading", retries: attempt, message: `Retry ${attempt}/${MAX_RETRIES}…` });
        await new Promise((r) => setTimeout(r, 800 * attempt));
      } else {
        patchLog(key, { status: "uploading" });
      }

      try {
        const form = new FormData();
        form.append("kind", item.kind);
        form.append("profileId", item.profileId);
        if (item.galleryId) form.append("galleryId", item.galleryId);
        form.append("sourceUrl", item.sourceUrl);

        const res  = await fetch("/api/admin/backfill/cloudinary", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed");

        patchLog(key, { status: "done", durationMs: Date.now() - itemStart });
        return;
      } catch (e) {
        const msg = (e as Error).message;
        if (attempt >= MAX_RETRIES) {
          patchLog(key, { status: "failed", message: msg, durationMs: Date.now() - itemStart });
          return;
        }
        attempt++;
      }
    }
  }

  // ── Run all ───────────────────────────────────────────────────────────

  async function runAll() {
    if (!snapshot || snapshot.pending.length === 0) return;

    const queue: Array<{ item: PendingItem; profileName: string; key: string }> = [];
    for (const p of snapshot.pending) {
      for (const item of p.items) {
        const key = `${p.profileId}:${item.kind}:${item.galleryId ?? "-"}`;
        queue.push({ item, profileName: p.fullName, key });
      }
    }

    setRunning(true);
    setPaused(false);
    setStartedAt(Date.now());
    setLogs(queue.map(({ item, profileName, key }) => ({
      key,
      profileName,
      kind: item.kind,
      status: "queued",
    })));

    for (const { item, profileName, key } of queue) {
      while (pausedRef.current && runningRef.current) {
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!runningRef.current) break;
      await processItem(item, profileName, key);
    }

    setRunning(false);
    setPaused(false);
    toast({ title: "Backfill complete", description: "Refreshing status…" });
    await loadSnapshot();
  }

  function stop() {
    setRunning(false);
    setPaused(false);
  }

  // ── Derived stats ─────────────────────────────────────────────────────

  const doneCount      = logs.filter((l) => l.status === "done" || l.status === "skipped").length;
  const failedCount    = logs.filter((l) => l.status === "failed").length;
  const completedCount = doneCount + failedCount;
  const progressPct    = logs.length > 0 ? (completedCount / logs.length) * 100 : 0;
  const pendingItemCount = snapshot?.pending.reduce((acc, p) => acc + p.items.length, 0) ?? 0;

  const avgDuration = (() => {
    const done = logs.filter((l) => l.durationMs != null);
    if (!done.length) return null;
    return Math.round(done.reduce((s, l) => s + (l.durationMs ?? 0), 0) / done.length);
  })();

  const etaSecs = (() => {
    if (!startedAt || completedCount === 0 || !running) return null;
    const elapsed   = (Date.now() - startedAt) / 1000;
    const rate      = completedCount / elapsed;
    const remaining = logs.length - completedCount;
    return Math.round(remaining / rate);
  })();

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Cloudinary Backfill"
        description="Migrate existing model photos to the secure Cloudinary architecture."
        action={
          <Button
            variant="ghost" size="sm"
            onClick={loadSnapshot}
            disabled={loading || running}
            className="gap-2 text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {/* Info banner */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-sm">
          <p className="font-bold text-amber-400">What this does</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Existing model photos stored in the legacy bucket are re-uploaded through
            the server, which handles face-blurring and places the result in the
            correct Cloudinary folders automatically.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Keep this tab open while running. Safe to pause/resume and re-run —
            already-migrated items are skipped. Failed items are retried up to{" "}
            {MAX_RETRIES} times automatically.
          </p>
        </div>
      </div>

      {/* Loading state */}
      {loading && !snapshot && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 text-gold animate-spin" />
        </div>
      )}

      {/* Stats cards */}
      {snapshot && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Models" value={snapshot.total} />
          <StatCard label="Already Secure" value={snapshot.alreadyMigrated} color="emerald" />
          <StatCard
            label={snapshot.pending.length > 0 ? "Needs Backfill" : "Nothing Pending"}
            value={snapshot.pending.length}
            subValue={pendingItemCount > 0 ? `${pendingItemCount} images` : undefined}
            color={snapshot.pending.length > 0 ? "amber" : "emerald"}
          />
        </div>
      )}

      {/* Run button */}
      {snapshot && snapshot.pending.length > 0 && !running && (
        <Button
          onClick={runAll}
          className="w-full h-11 bg-gold-gradient text-primary-foreground font-semibold gap-2"
        >
          <Play className="h-4 w-4" />
          Run Backfill ({pendingItemCount} images across {snapshot.pending.length} models)
        </Button>
      )}

      {/* Progress panel */}
      {running && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-gold" />
              {completedCount}/{logs.length} complete
              {failedCount > 0 && (
                <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                  {failedCount} failed
                </Badge>
              )}
              {etaSecs != null && (
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  ~{etaSecs < 60 ? `${etaSecs}s` : `${Math.round(etaSecs / 60)}m`} left
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setPaused((p) => !p)}
                className="gap-1.5 text-xs h-8"
              >
                {paused
                  ? <><Play  className="h-3 w-3" />Resume</>
                  : <><Pause className="h-3 w-3" />Pause</>}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={stop}
                className="gap-1.5 text-xs h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                Stop
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <Progress value={progressPct} className="h-2" />

          {/* Live telemetry row */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-gold" />
              {doneCount} done
            </span>
            {failedCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="h-3 w-3" />
                {failedCount} failed
              </span>
            )}
            {avgDuration != null && (
              <span className="flex items-center gap-1">
                <BarChart2 className="h-3 w-3" />
                avg {avgDuration}ms/img
              </span>
            )}
          </div>

          {paused && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <Pause className="h-3 w-3" /> Paused — press Resume to continue
            </p>
          )}
        </div>
      )}

      {/* All done */}
      {snapshot && snapshot.pending.length === 0 && !running && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          <div>
            <p className="font-bold text-emerald-400">All models secure</p>
            <p className="text-xs text-muted-foreground">Every photo is using the new architecture.</p>
          </div>
        </div>
      )}

      {/* ── Live log list ── */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="h-0.5 bg-gold-gradient" />

          {/* Column header */}
          <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2 bg-secondary/40 border-b border-border">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Model / type
            </span>
            <div className="flex gap-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {showTelemetry && (
                <>
                  <span className="w-16 text-right">Duration</span>
                  <span className="w-10 text-right">Tries</span>
                </>
              )}
              <button
                onClick={() => setShowTelemetry((v) => !v)}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
              >
                <BarChart2 className="h-3 w-3" />
                {showTelemetry ? "Hide" : "Timings"}
              </button>
              <span className="w-20 text-right">Status</span>
            </div>
          </div>

          <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
            {logs.map((log) => {
              const isActive = log.status === "uploading";
              return (
                <div
                  key={log.key}
                  ref={isActive ? activeItemRef : undefined}
                  className={cn(
                    "px-4 py-2.5 flex items-center justify-between gap-3 transition-colors",
                    isActive          && "bg-gold/5",
                    log.status === "failed" && "bg-destructive/5",
                  )}
                >
                  {/* Left: name + type */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <StatusIcon status={log.status} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate leading-tight">
                        {log.profileName}
                        <span className="text-muted-foreground text-xs ml-2">
                          {log.kind === "profile" ? "profile picture" : "gallery photo"}
                        </span>
                        {log.retries != null && log.retries > 0 && (
                          <span className="text-amber-400 text-[10px] ml-1.5">
                            retry {log.retries}
                          </span>
                        )}
                      </p>
                      {log.message && (
                        <p className={cn(
                          "text-[11px] truncate leading-tight mt-0.5",
                          log.status === "failed" ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {log.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: timings + status badge */}
                  <div className="flex items-center gap-4 shrink-0">
                    {showTelemetry && (
                      <div className="flex gap-4 text-[11px] text-muted-foreground font-mono">
                        <span className="w-16 text-right font-semibold text-foreground">
                          {fmt(log.durationMs)}
                        </span>
                        <span className="w-10 text-right">
                          {log.retries != null && log.retries > 0 ? log.retries + 1 : 1}
                        </span>
                      </div>
                    )}
                    <StatusBadge status={log.status} />
                  </div>
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>

          {/* Summary footer */}
          {!running && logs.length > 0 && (
            <div className="px-4 py-3 bg-secondary/30 border-t border-border flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
              <span className="text-emerald-400 font-semibold">{doneCount} migrated</span>
              {failedCount > 0 && (
                <span className="text-destructive font-semibold">{failedCount} failed</span>
              )}
              {avgDuration != null && <span>avg {avgDuration}ms/image</span>}
              {startedAt != null && (
                <span>total {((Date.now() - startedAt) / 1000).toFixed(1)}s</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pre-run pending list */}
      {snapshot && snapshot.pending.length > 0 && logs.length === 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/50">
            <p className="text-xs font-bold text-foreground flex items-center gap-2">
              <UserIcon className="h-3.5 w-3.5 text-gold" />
              Pending Profiles
            </p>
          </div>
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {snapshot.pending.map((p) => (
              <div key={p.profileId} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{p.fullName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{p.email}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-[11px] text-muted-foreground">
                  <Images className="h-3 w-3" />
                  {p.items.length}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function StatCard({
  label, value, subValue, color,
}: {
  label: string;
  value: number;
  subValue?: string;
  color?: "emerald" | "amber";
}) {
  const colorMap: Record<"emerald" | "amber", { border: string; text: string; label: string }> = {
    emerald: { border: "border-emerald-500/20 bg-emerald-500/5", text: "text-emerald-400", label: "text-emerald-400" },
    amber:   { border: "border-amber-500/30  bg-amber-500/5",   text: "text-amber-400",   label: "text-amber-400"   },
  };
  const colorCls = color
    ? colorMap[color]
    : { border: "border-border bg-card", text: "text-foreground", label: "text-muted-foreground" };

  return (
    <div className={cn("rounded-xl border p-4", colorCls.border)}>
      <p className={cn("text-xs", colorCls.label)}>{label}</p>
      <p className={cn("text-2xl font-black mt-1", colorCls.text)}>{value}</p>
      {subValue && <p className="text-[10px] text-muted-foreground mt-1">{subValue}</p>}
    </div>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  switch (status) {
    case "queued":    return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
    case "uploading": return <Loader2 className="h-4 w-4 text-gold animate-spin shrink-0" />;
    case "done":      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
    case "skipped":   return <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />;
    case "failed":    return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  }
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const map: Record<ItemStatus, { label: string; cls: string }> = {
    queued:   { label: "Queued",    cls: "border-border text-muted-foreground"        },
    uploading:{ label: "Uploading", cls: "border-purple-500/30 text-purple-400"       },
    done:     { label: "Done",      cls: "border-emerald-500/30 text-emerald-400"     },
    skipped:  { label: "Skipped",   cls: "border-border text-muted-foreground"        },
    failed:   { label: "Failed",    cls: "border-destructive/30 text-destructive"     },
  };
  const { label, cls } = map[status];
  return (
    <Badge variant="outline" className={cn("text-[10px] shrink-0 w-20 justify-center", cls)}>
      {label}
    </Badge>
  );
}

/** Format milliseconds compactly: "123ms" or "1.2s" */
function fmt(ms?: number): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}