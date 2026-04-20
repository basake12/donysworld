"use client";

import { useEffect, useState, useRef } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, Play, Pause,
  RefreshCw, Images, User as UserIcon, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface ItemLog {
  key: string; // profileId:kind:galleryId
  profileName: string;
  kind: "profile" | "gallery";
  status: "queued" | "processing" | "done" | "failed";
  message?: string;
}

export function BackfillClient() {
  const { toast } = useToast();

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [running,  setRunning]  = useState(false);
  const [paused,   setPaused]   = useState(false);
  const [logs,     setLogs]     = useState<ItemLog[]>([]);

  const pausedRef  = useRef(paused);
  const runningRef = useRef(running);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { runningRef.current = running; }, [running]);

  async function loadSnapshot() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/backfill/face-blur", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setSnapshot(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      toast({ title: "Couldn't load backfill status", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Process ONE item (download, blur, upload) ─────────────────────────
  async function processItem(item: PendingItem, profileName: string, key: string): Promise<void> {
    setLogs((prev) => prev.map((l) => l.key === key ? { ...l, status: "processing" } : l));

    try {
      // 1. Download the source image from the public URL.
      //    CORS: Supabase public buckets return a permissive origin, so
      //    fetch() + Blob should just work in the browser.
      const srcRes = await fetch(item.sourceUrl, { cache: "no-store" });
      if (!srcRes.ok) throw new Error(`Source download ${srcRes.status}`);
      const srcBlob = await srcRes.blob();
      const srcType = srcBlob.type || "image/jpeg";
      const srcFile = new File([srcBlob], `source_${item.profileId}_${Date.now()}.jpg`, {
        type: srcType,
      });

      // 2. Run MediaPipe blur.
      const { blurFace } = await import("@/lib/face-blur-client");
      const blurResult = await blurFace(srcFile, {
        filename: `backfill_${item.profileId}_${Date.now()}.jpg`,
      });

      // 3. Upload pair (blurred + original) back to the backfill endpoint.
      const form = new FormData();
      form.append("kind", item.kind);
      form.append("profileId", item.profileId);
      if (item.galleryId) form.append("galleryId", item.galleryId);
      form.append("blurredImage", blurResult.blurredFile);
      form.append("originalImage", srcFile);

      const upRes = await fetch("/api/admin/backfill/face-blur", { method: "POST", body: form });
      const upJson = await upRes.json();
      if (!upRes.ok) throw new Error(upJson.error || `Upload ${upRes.status}`);

      setLogs((prev) => prev.map((l) => l.key === key ? { ...l, status: "done" } : l));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      console.error(`[backfill] ${key} failed`, e);
      setLogs((prev) => prev.map((l) => l.key === key ? { ...l, status: "failed", message: msg } : l));
    }
  }

  async function runAll() {
    if (!snapshot || snapshot.pending.length === 0) return;

    // Flatten into a single queue of items with stable keys.
    const queue: Array<{ item: PendingItem; profileName: string; key: string }> = [];
    for (const p of snapshot.pending) {
      for (const item of p.items) {
        const key = `${p.profileId}:${item.kind}:${item.galleryId ?? "-"}`;
        queue.push({ item, profileName: p.fullName, key });
      }
    }

    setRunning(true);
    setPaused(false);
    setLogs(queue.map(({ item, profileName, key }) => ({
      key, profileName, kind: item.kind, status: "queued",
    })));

    for (const { item, profileName, key } of queue) {
      while (pausedRef.current && runningRef.current) {
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!runningRef.current) break;

      await processItem(item, profileName, key);
    }

    setRunning(false);
    setPaused(false);
    toast({ title: "Backfill complete", description: "Refreshing status..." });
    await loadSnapshot();
  }

  function stop() {
    setRunning(false);
    setPaused(false);
  }

  const completedCount = logs.filter((l) => l.status === "done" || l.status === "failed").length;
  const failedCount    = logs.filter((l) => l.status === "failed").length;
  const progressPct    = logs.length > 0 ? (completedCount / logs.length) * 100 : 0;

  const pendingItemCount = snapshot?.pending.reduce((acc, p) => acc + p.items.length, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Face Blur Backfill"
        description="Migrate existing model photos to the secure architecture."
        action={
          <Button variant="ghost" size="sm" onClick={loadSnapshot} disabled={loading || running}
            className="gap-2 text-xs">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-sm">
          <p className="font-bold text-amber-400">What this does</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Existing model photos have their raw originals in the public bucket
            (legacy). This tool downloads each one in YOUR browser, blurs the
            face with MediaPipe, uploads the blurred copy to the public bucket,
            and moves the original to the private bucket — where the reveal-URL
            endpoint is the only way to access it.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Keep this tab open while running. Each image takes 1&ndash;3 seconds.
            Safe to pause/resume. Safe to re-run — already-migrated items are skipped.
          </p>
        </div>
      </div>

      {loading && !snapshot && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 text-gold animate-spin" />
        </div>
      )}

      {snapshot && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Models</p>
            <p className="text-2xl font-black text-foreground mt-1">{snapshot.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs text-emerald-400">Already Secure</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{snapshot.alreadyMigrated}</p>
          </div>
          <div className={cn(
            "rounded-xl border p-4",
            snapshot.pending.length > 0
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-emerald-500/20 bg-emerald-500/5"
          )}>
            <p className={cn("text-xs", snapshot.pending.length > 0 ? "text-amber-400" : "text-emerald-400")}>
              {snapshot.pending.length > 0 ? "Needs Backfill" : "Nothing Pending"}
            </p>
            <p className={cn("text-2xl font-black mt-1", snapshot.pending.length > 0 ? "text-amber-400" : "text-emerald-400")}>
              {snapshot.pending.length}
            </p>
            {pendingItemCount > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">{pendingItemCount} images</p>
            )}
          </div>
        </div>
      )}

      {snapshot && snapshot.pending.length > 0 && !running && (
        <Button onClick={runAll}
          className="w-full h-11 bg-gold-gradient text-primary-foreground font-semibold gap-2">
          <Play className="h-4 w-4" />
          Run Backfill ({pendingItemCount} images across {snapshot.pending.length} models)
        </Button>
      )}

      {running && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-gold" />
              Processing {completedCount}/{logs.length}
              {failedCount > 0 && (
                <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                  {failedCount} failed
                </Badge>
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)}
                className="gap-1.5 text-xs h-8">
                {paused
                  ? <><Play className="h-3 w-3" />Resume</>
                  : <><Pause className="h-3 w-3" />Pause</>}
              </Button>
              <Button variant="outline" size="sm" onClick={stop}
                className="gap-1.5 text-xs h-8 border-destructive/30 text-destructive hover:bg-destructive/10">
                Stop
              </Button>
            </div>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      )}

      {snapshot && snapshot.pending.length === 0 && !running && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          <div>
            <p className="font-bold text-emerald-400">All models secure</p>
            <p className="text-xs text-muted-foreground">Every photo is using the new architecture.</p>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="h-0.5 bg-gold-gradient" />
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {logs.map((log) => (
              <div key={log.key} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <StatusIcon status={log.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">
                      {log.profileName}
                      <span className="text-muted-foreground text-xs ml-2">
                        {log.kind === "profile" ? "profile picture" : "gallery photo"}
                      </span>
                    </p>
                    {log.message && (
                      <p className="text-[11px] text-destructive truncate">{log.message}</p>
                    )}
                  </div>
                </div>
                <StatusBadge status={log.status} />
              </div>
            ))}
          </div>
        </div>
      )}

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

function StatusIcon({ status }: { status: ItemLog["status"] }) {
  if (status === "queued")     return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
  if (status === "processing") return <Loader2 className="h-4 w-4 text-gold animate-spin" />;
  if (status === "done")       return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "failed")     return <XCircle className="h-4 w-4 text-destructive" />;
  return null;
}

function StatusBadge({ status }: { status: ItemLog["status"] }) {
  const map: Record<ItemLog["status"], { label: string; cls: string }> = {
    queued:     { label: "Queued",     cls: "border-border text-muted-foreground" },
    processing: { label: "Processing", cls: "border-gold/30 text-gold" },
    done:       { label: "Done",       cls: "border-emerald-500/30 text-emerald-400" },
    failed:     { label: "Failed",     cls: "border-destructive/30 text-destructive" },
  };
  const { label, cls } = map[status];
  return <Badge variant="outline" className={cn("text-[10px] shrink-0", cls)}>{label}</Badge>;
}