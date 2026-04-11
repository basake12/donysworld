"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { useToast } from "@/components/ui/use-toast";
import {
  ShieldX, Trash2, Plus, Loader2, Mail, Phone, User,
  Search, TriangleAlert, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── TYPES ──────────────────────────────────────

type IdentifierType = "EMAIL" | "PHONE" | "NAME";

interface BlocklistEntry {
  id: string;
  identifierType: IdentifierType;
  identifier: string;
  note: string | null;
  createdAt: string;
}

// ─── SCHEMA ─────────────────────────────────────

const addSchema = z.object({
  identifierType: z.enum(["EMAIL", "PHONE", "NAME"]),
  identifier: z.string().min(2, "Enter a valid value"),
  note: z.string().max(300).optional(),
});

type AddFormData = z.infer<typeof addSchema>;

// ─── HELPERS ────────────────────────────────────

const TYPE_CONFIG: Record<IdentifierType, { label: string; icon: typeof Mail; placeholder: string; color: string }> = {
  EMAIL: {
    label: "Email",
    icon: Mail,
    placeholder: "e.g. john@example.com",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  },
  PHONE: {
    label: "Phone / WhatsApp",
    icon: Phone,
    placeholder: "e.g. +2348012345678",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  },
  NAME: {
    label: "Name",
    icon: User,
    placeholder: "e.g. John Doe",
    color: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── COMPONENT ──────────────────────────────────

export default function BlocklistPage() {
  const { toast } = useToast();

  const [entries, setEntries]         = useState<BlocklistEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [showNoteFor, setShowNoteFor] = useState<string | null>(null);
  const [showForm, setShowForm]       = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } =
    useForm<AddFormData>({
      resolver: zodResolver(addSchema),
      defaultValues: { identifierType: "EMAIL" },
    });

  const selectedType = watch("identifierType") as IdentifierType;

  // ── Fetch blocklist ──────────────────────────
  useEffect(() => {
    fetchEntries();
  }, []);

  async function fetchEntries() {
    setLoading(true);
    try {
      const res = await fetch("/api/model/blocklist");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEntries(data.entries);
    } catch (err: any) {
      toast({ title: "Failed to load blocklist", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ── Add entry ────────────────────────────────
  async function onSubmit(data: AddFormData) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/model/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setEntries((prev) => [json.entry, ...prev]);
      reset({ identifierType: "EMAIL", identifier: "", note: "" });
      setShowForm(false);
      toast({ title: "Blocked ✓", description: "This client will no longer find you." });
    } catch (err: any) {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete entry ─────────────────────────────
  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/model/blocklist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast({ title: "Removed", description: "Entry removed from your blocklist." });
    } catch (err: any) {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  // ── Filtered list ────────────────────────────
  const filtered = entries.filter((e) =>
    !search || e.identifier.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── HEADER ──────────────────────────── */}
      <PageHeader
        title="Blocklist"
        description="Blocked clients will never see your profile in the browse page."
        action={
          <Button
            onClick={() => setShowForm((p) => !p)}
            className="bg-gold-gradient text-black font-bold hover:opacity-90 rounded-xl gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Block
          </Button>
        }
      />

      {/* ── INFO NOTICE ─────────────────────── */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <TriangleAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-amber-400">How blocking works</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When a client's email, phone number, or name matches an entry here, your profile is
            completely hidden from their browse page. They will never know they are blocked.
            Matching is case-insensitive.
          </p>
        </div>
      </div>

      {/* ── ADD FORM ────────────────────────── */}
      {showForm && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">
          <div className="h-0.5 bg-gold-gradient" />
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldX className="h-4 w-4 text-gold" />
              Block a client
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Type selector */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Block by</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["EMAIL", "PHONE", "NAME"] as IdentifierType[]).map((type) => {
                    const cfg = TYPE_CONFIG[type];
                    const Icon = cfg.icon;
                    const selected = selectedType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setValue("identifierType", type)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 text-center transition-all duration-200",
                          selected
                            ? "border-gold bg-gold/10 text-gold"
                            : "border-border bg-secondary text-muted-foreground hover:border-gold/30"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[11px] font-semibold">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Identifier input */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">
                  {TYPE_CONFIG[selectedType].label} to block
                </Label>
                <Input
                  placeholder={TYPE_CONFIG[selectedType].placeholder}
                  {...register("identifier")}
                  className="h-11 bg-secondary border-border focus:border-gold rounded-xl"
                />
                {errors.identifier && (
                  <p className="text-xs text-destructive">{errors.identifier.message}</p>
                )}
              </div>

              {/* Note (optional) */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-muted-foreground">
                  Note <span className="text-xs font-normal">(optional — only you see this)</span>
                </Label>
                <Input
                  placeholder="e.g. Aggressive client, no-show"
                  {...register("note")}
                  className="h-11 bg-secondary border-border focus:border-gold rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowForm(false); reset(); }}
                  className="flex-1 border-border rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gold-gradient text-black font-bold hover:opacity-90 rounded-xl"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Block Client"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SEARCH ──────────────────────────── */}
      {entries.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search blocked entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border focus:border-gold rounded-xl h-11"
          />
        </div>
      )}

      {/* ── LIST ────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-gold animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border border-dashed border-border">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary border border-border">
            <ShieldX className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-semibold text-foreground">
              {search ? "No matches found" : "No blocked clients"}
            </p>
            <p className="text-sm text-muted-foreground">
              {search
                ? "Try a different search term"
                : "Use the + Add Block button to hide yourself from specific clients."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground px-1">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            {search && ` matching "${search}"`}
          </p>
          {filtered.map((entry) => {
            const cfg  = TYPE_CONFIG[entry.identifierType];
            const Icon = cfg.icon;
            const isDeleting = deletingId === entry.id;
            const noteVisible = showNoteFor === entry.id;

            return (
              <div
                key={entry.id}
                className="group rounded-2xl border border-border bg-card p-4 flex items-start gap-3 hover:border-gold/20 transition-all"
              >
                {/* Type icon */}
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                  cfg.color
                )}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-[10px] px-2 py-0 border rounded-full", cfg.color)}>
                      {cfg.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{entry.identifier}</p>

                  {/* Note toggle */}
                  {entry.note && (
                    <button
                      onClick={() => setShowNoteFor(noteVisible ? null : entry.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {noteVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {noteVisible ? "Hide note" : "Show note"}
                    </button>
                  )}
                  {entry.note && noteVisible && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2 mt-1">
                      {entry.note}
                    </p>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(entry.id)}
                  disabled={isDeleting}
                  className="opacity-0 group-hover:opacity-100 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/15 transition-all disabled:opacity-40"
                >
                  {isDeleting
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}