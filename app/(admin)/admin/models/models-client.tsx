"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck,
  Search,
  Eye,
  EyeOff,
  FileText,
  MapPin,
  Phone,
  Mail,
  Coins,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Loader2,
  ExternalLink,
  Calendar,
  Pencil,
  Trash2,
  KeyRound,
  Images,
  Save,
} from "lucide-react";
import { formatCoins } from "@/lib/coins";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { NIGERIA_STATES, getCitiesForState } from "@/lib/nigeria-states";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface ModelDocument {
  id: string;
  documentType: string;
  documentUrl: string;
  uploadedAt: string;
}

interface ModelCharge {
  meetType: "SHORT" | "OVERNIGHT" | "WEEKEND";
  minCoins: number;
  maxCoins: number;
}

interface GalleryItem {
  id: string;
  imageUrl: string;
  order: number;
}

interface Model {
  id: string;
  status: "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED" | "REJECTED";
  age: number;
  height: string;
  city: string;
  state: string;
  bodyType: string;
  complexion: string;
  about: string;
  profilePictureUrl: string;
  allowFaceReveal: boolean;
  isFaceBlurred: boolean;
  isAvailable: boolean;
  user: {
    id: string;
    fullName: string;
    nickname?: string | null;
    email: string;
    whatsappNumber: string;
    gender: string;
    createdAt: string;
  };
  documents: ModelDocument[];
  charges: ModelCharge[];
  gallery: GalleryItem[];
  _count: { faceReveals: number };
}

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDING_APPROVAL: {
    label: "Pending",
    icon: Clock,
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  ACTIVE: {
    label: "Active",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  SUSPENDED: {
    label: "Suspended",
    icon: Ban,
    className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
} as const;

const MEET_LABELS = {
  SHORT: "Short Meet",
  OVERNIGHT: "Overnight",
  WEEKEND: "Weekend",
} as const;

const DOC_LABELS: Record<string, string> = {
  NIN: "NIN",
  DRIVERS_LICENSE: "Driver's License",
  VOTERS_CARD: "Voter's Card",
  INTERNATIONAL_PASSPORT: "Int'l Passport",
};

const BODY_TYPES  = ["SLIM", "AVERAGE", "ATHLETIC", "CURVY", "PLUS_SIZE"];
const COMPLEXIONS = ["FAIR", "LIGHT", "MEDIUM", "OLIVE", "TAN", "DARK"];

// ─────────────────────────────────────────────
// ADMIN EDIT MODAL  (new)
// ─────────────────────────────────────────────

function AdminEditModal({
  model,
  open,
  onClose,
  onRefresh,
}: {
  model: Model | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { toast }    = useToast();
  const [saving,     setSaving]   = useState(false);
  const [deleting,   setDeleting] = useState<string | null>(null);
  const [showPw,     setShowPw]   = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [form,       setForm]     = useState<Record<string, any>>({});

  function field<T>(key: string, fallback: T): T {
    return key in form ? form[key] : fallback;
  }
  function set(key: string, val: any) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  if (!model) return null;

  const selectedState = field("state", model.state);
  const inputCls = "bg-secondary border-border focus:border-gold h-10 rounded-xl text-sm";
  const config     = STATUS_CONFIG[model.status];
  const StatusIcon = config.icon;

  async function save() {
    if (Object.keys(form).length === 0) { onClose(); return; }
    if (form.newPassword !== undefined && form.newPassword.length > 0 && form.newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.newPassword) delete body.newPassword;
      const res  = await fetch(`/api/admin/models/${model.id}/edit`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Model updated!" });
      setForm({});
      onRefresh();
      onClose();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteGallery(galleryId: string) {
    setDeleting(galleryId);
    try {
      const res  = await fetch(`/api/admin/models/${model.id}/edit?galleryId=${galleryId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Photo deleted" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  async function viewDocument(docPath: string) {
    setLoadingDoc(true);
    try {
      const res  = await fetch(`/api/admin/document-url?path=${encodeURIComponent(docPath)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.open(data.url, "_blank");
    } catch { } finally { setLoadingDoc(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setForm({}); onClose(); } }}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Pencil className="h-5 w-5 text-gold" />
            Edit Model — {model.user.fullName}
          </DialogTitle>
        </DialogHeader>

        <div className="h-0.5 w-full bg-gold-gradient rounded-full" />

        {/* Profile header */}
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden border border-border bg-secondary">
            <img src={model.profilePictureUrl} alt={model.user.fullName} className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{model.user.fullName}</p>
            <p className="text-xs text-muted-foreground">{model.user.email}</p>
            <Badge variant="outline" className={cn("text-xs gap-1 mt-1", config.className)}>
              <StatusIcon className="h-3 w-3" />{config.label}
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="account" className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
            <TabsTrigger value="docs">Documents</TabsTrigger>
          </TabsList>

          {/* ── ACCOUNT ─────────────────────────────── */}
          <TabsContent value="account" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Full Name</Label>
                <Input className={inputCls} defaultValue={model.user.fullName}
                  onChange={(e) => set("fullName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nickname</Label>
                <Input className={inputCls} defaultValue={model.user.nickname ?? ""}
                  placeholder="Optional" onChange={(e) => set("nickname", e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-gold" />WhatsApp Number
              </Label>
              <Input className={inputCls} defaultValue={model.user.whatsappNumber}
                onChange={(e) => set("whatsappNumber", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email (read-only)</Label>
              <Input className={cn(inputCls, "opacity-60")} value={model.user.email} disabled />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <KeyRound className="h-3 w-3 text-gold" />Reset Password
              </Label>
              <div className="relative">
                <Input type={showPw ? "text" : "password"} className={cn(inputCls, "pr-10")}
                  placeholder="New password (min 8 chars)"
                  onChange={(e) => set("newPassword", e.target.value)} />
                <button type="button" onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">Leave blank to keep current password.</p>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-xs font-semibold">Status & Settings</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Account Status</Label>
                  <Select defaultValue={model.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Availability</Label>
                  <Select defaultValue={model.isAvailable ? "true" : "false"}
                    onValueChange={(v) => set("isAvailable", v === "true")}>
                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Available</SelectItem>
                      <SelectItem value="false">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="allowFaceReveal" defaultChecked={model.allowFaceReveal} title="Allow Face Reveal"
                    onChange={(e) => set("allowFaceReveal", e.target.checked)} className="rounded" />
                  <Label htmlFor="allowFaceReveal" className="text-xs cursor-pointer">Allow Face Reveal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isFaceBlurred" defaultChecked={model.isFaceBlurred} title="Face Is Blurred"
                    onChange={(e) => set("isFaceBlurred", e.target.checked)} className="rounded" />
                  <Label htmlFor="isFaceBlurred" className="text-xs cursor-pointer">Face Is Blurred</Label>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── PROFILE ─────────────────────────────── */}
          <TabsContent value="profile" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Age</Label>
                <Input type="number" min={18} max={60} className={inputCls}
                  defaultValue={model.age || ""}
                  onChange={(e) => set("age", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Height</Label>
                <Input className={inputCls} defaultValue={model.height} placeholder="e.g. 5'7&quot;"
                  onChange={(e) => set("height", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Body Type</Label>
                <Select defaultValue={model.bodyType} onValueChange={(v) => set("bodyType", v)}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BODY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Complexion</Label>
                <Select defaultValue={model.complexion} onValueChange={(v) => set("complexion", v)}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPLEXIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-gold" />State
                </Label>
                <Select defaultValue={model.state}
                  onValueChange={(v) => { set("state", v); set("city", ""); }}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-56">
                    {NIGERIA_STATES.map((s) => (
                      <SelectItem key={s.state} value={s.state}>{s.state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">City</Label>
                <Select defaultValue={model.city} onValueChange={(v) => set("city", v)}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-56">
                    {getCitiesForState(selectedState).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">About</Label>
              <textarea rows={4} defaultValue={model.about}
                onChange={(e) => set("about", e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none resize-none"
                placeholder="Model bio..." />
            </div>

            {model.charges.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-gold" />Current Charges
                  </Label>
                  {model.charges.map((c) => (
                    <div key={c.meetType}
                      className="flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{MEET_LABELS[c.meetType]}</span>
                      <span className="text-gold font-medium">
                        {c.minCoins.toLocaleString()} – {c.maxCoins.toLocaleString()} DC
                      </span>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">Charges are set by the model from their profile.</p>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── GALLERY ─────────────────────────────── */}
          <TabsContent value="gallery" className="pt-4">
            {model.gallery.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center gap-2">
                <Images className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No gallery photos yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {model.gallery.map((item) => (
                  <div key={item.id}
                    className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border bg-secondary group">
                    <img src={item.imageUrl} alt="Gallery" className="h-full w-full object-cover" />
                    <button onClick={() => deleteGallery(item.id)} disabled={deleting === item.id}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive">
                      {deleting === item.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── DOCUMENTS ───────────────────────────── */}
          <TabsContent value="docs" className="pt-4 space-y-3">
            {model.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No documents uploaded.</p>
            ) : (
              model.documents.map((doc) => (
                <div key={doc.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-secondary p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gold" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {DOC_LABELS[doc.documentType] ?? doc.documentType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(doc.uploadedAt).toLocaleDateString("en-NG", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => viewDocument(doc.documentUrl)}
                    disabled={loadingDoc}
                    className="border-gold/30 text-gold hover:bg-gold/10 gap-1.5 h-8 text-xs">
                    {loadingDoc ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                    View
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Save / Cancel */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => { setForm({}); onClose(); }} className="flex-1 border-border">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}
            className="flex-1 bg-gold-gradient text-black font-black hover:opacity-90">
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// MODEL DETAIL MODAL  (original — kept intact)
// ─────────────────────────────────────────────

function ModelDetailModal({
  model,
  open,
  onClose,
  onAction,
  onEdit,
}: {
  model: Model | null;
  open: boolean;
  onClose: () => void;
  onAction: (
    modelId: string,
    profileId: string,
    action: "approve" | "reject" | "suspend" | "unsuspend"
  ) => void;
  onEdit: () => void;
}) {
  const [loadingDoc, setLoadingDoc] = useState(false);

  if (!model) return null;

  const config     = STATUS_CONFIG[model.status];
  const StatusIcon = config.icon;

  async function viewDocument(docPath: string) {
    setLoadingDoc(true);
    try {
      const res  = await fetch(`/api/admin/document-url?path=${encodeURIComponent(docPath)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.open(data.url, "_blank");
    } catch {
      // silent
    } finally {
      setLoadingDoc(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ShieldCheck className="h-5 w-5 text-gold" />
            Model Review
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="h-0.5 w-full bg-gold-gradient rounded-full" />

          {/* Profile header */}
          <div className="flex items-start gap-4">
            <div className="relative h-20 w-20 shrink-0 rounded-xl overflow-hidden border border-border bg-secondary">
              <img src={model.profilePictureUrl} alt={model.user.fullName} className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground text-lg">{model.user.fullName}</h3>
                {model.user.nickname && (
                  <span className="text-sm text-muted-foreground">"{model.user.nickname}"</span>
                )}
                <Badge variant="outline" className={cn("text-xs gap-1", config.className)}>
                  <StatusIcon className="h-3 w-3" />{config.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />{model.user.email}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />{model.user.whatsappNumber}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Joined{" "}
                {new Date(model.user.createdAt).toLocaleDateString("en-NG", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Profile details */}
          <div className="rounded-xl border border-border bg-secondary p-4 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profile Details</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Age: </span><span className="text-foreground font-medium">{model.age || "Not set"}</span></div>
              <div><span className="text-muted-foreground">Height: </span><span className="text-foreground font-medium">{model.height || "Not set"}</span></div>
              <div><span className="text-muted-foreground">Body: </span><span className="text-foreground font-medium">{model.bodyType || "Not set"}</span></div>
              <div><span className="text-muted-foreground">Complexion: </span><span className="text-foreground font-medium">{model.complexion || "Not set"}</span></div>
              <div className="col-span-2">
                <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Location: </span>
                <span className="text-foreground font-medium">{model.city && model.state ? `${model.city}, ${model.state}` : "Not set"}</span>
              </div>
              <div className="col-span-2"><span className="text-muted-foreground">Gender: </span><span className="text-foreground font-medium">{model.user.gender}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">Face Reveals: </span><span className="text-gold font-medium">{model._count.faceReveals}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">Gallery: </span><span className="text-foreground font-medium">{model.gallery.length} photo(s)</span></div>
            </div>
            {model.about && (
              <>
                <Separator className="bg-border/50" />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">About</p>
                  <p className="text-sm text-foreground leading-relaxed">{model.about}</p>
                </div>
              </>
            )}
          </div>

          {/* Charges */}
          {model.charges.length > 0 && (
            <div className="rounded-xl border border-border bg-secondary p-4 space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Charges</p>
              <div className="space-y-1.5">
                {model.charges.map((charge) => (
                  <div key={charge.meetType} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{MEET_LABELS[charge.meetType]}</span>
                    <div className="flex items-center gap-1 text-gold font-medium">
                      <Coins className="h-3 w-3" />
                      {formatCoins(charge.minCoins)} – {formatCoins(charge.maxCoins)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legal documents */}
          <div className="rounded-xl border border-border bg-secondary p-4 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Legal Documents</p>
            {model.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded</p>
            ) : (
              <div className="space-y-2">
                {model.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gold" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{DOC_LABELS[doc.documentType] ?? doc.documentType}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded{" "}
                          {new Date(doc.uploadedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => viewDocument(doc.documentUrl)} disabled={loadingDoc}
                      className="border-gold/30 text-gold hover:bg-gold/10 gap-1.5 h-8 text-xs">
                      {loadingDoc ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit this model */}
          <Button onClick={() => { onClose(); onEdit(); }} variant="outline"
            className="w-full border-gold/30 text-gold hover:bg-gold/10 gap-2">
            <Pencil className="h-4 w-4" />Edit This Model
          </Button>

          {/* Status action buttons — original logic untouched */}
          <div className="space-y-2 pt-1">
            {model.status === "PENDING_APPROVAL" && (
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => onAction(model.user.id, model.id, "reject")}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  <XCircle className="mr-2 h-4 w-4" />Reject
                </Button>
                <Button onClick={() => onAction(model.user.id, model.id, "approve")}
                  className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90">
                  <CheckCircle2 className="mr-2 h-4 w-4" />Approve
                </Button>
              </div>
            )}
            {model.status === "ACTIVE" && (
              <Button variant="outline" onClick={() => onAction(model.user.id, model.id, "suspend")}
                className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
                <Ban className="mr-2 h-4 w-4" />Suspend Model
              </Button>
            )}
            {model.status === "SUSPENDED" && (
              <Button onClick={() => onAction(model.user.id, model.id, "unsuspend")}
                className="w-full bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90">
                <CheckCircle2 className="mr-2 h-4 w-4" />Reinstate Model
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export function AdminModelsClient({ models }: { models: Model[] }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { toast }    = useToast();

  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState(
    searchParams.get("filter") === "pending" ? "PENDING_APPROVAL" : "all"
  );
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [editOpen,      setEditOpen]      = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    modelUserId: string;
    profileId: string;
    action: "approve" | "reject" | "suspend" | "unsuspend";
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const filtered = useMemo(() => models.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      m.user.fullName.toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q) ||
      m.city.toLowerCase().includes(q) ||
      m.state.toLowerCase().includes(q);
    return matchesSearch && (statusFilter === "all" || m.status === statusFilter);
  }), [models, search, statusFilter]);

  const counts = useMemo(() => ({
    all:              models.length,
    PENDING_APPROVAL: models.filter((m) => m.status === "PENDING_APPROVAL").length,
    ACTIVE:           models.filter((m) => m.status === "ACTIVE").length,
    SUSPENDED:        models.filter((m) => m.status === "SUSPENDED").length,
    REJECTED:         models.filter((m) => m.status === "REJECTED").length,
  }), [models]);

  function openDetail(model: Model) { setSelectedModel(model); setDetailOpen(true); }
  function openEdit(model: Model)   { setSelectedModel(model); setEditOpen(true); }

  function handleAction(
    modelUserId: string,
    profileId: string,
    action: "approve" | "reject" | "suspend" | "unsuspend"
  ) {
    setDetailOpen(false);
    setConfirmAction({ modelUserId, profileId, action });
  }

  async function executeAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const res  = await fetch("/api/admin/models", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmAction),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      const labels: Record<string, string> = {
        approve: "Model approved and activated",
        reject:  "Model application rejected",
        suspend: "Model account suspended",
        unsuspend: "Model account reinstated",
      };
      toast({ title: labels[confirmAction.action] });
      setConfirmAction(null);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }

  const ACTION_CONFIG = {
    approve:   { title: "Approve Model?",      description: "This will activate the model's account and allow them to receive offers from clients.", actionLabel: "Yes, Approve",   actionClass: "bg-gold-gradient text-primary-foreground hover:opacity-90" },
    reject:    { title: "Reject Application?", description: "This will reject the model's application. They will not be able to log in.",             actionLabel: "Yes, Reject",    actionClass: "bg-destructive text-destructive-foreground" },
    suspend:   { title: "Suspend Model?",       description: "This will prevent the model from logging in and receiving new offers.",                   actionLabel: "Yes, Suspend",   actionClass: "bg-orange-500 text-white hover:bg-orange-600" },
    unsuspend: { title: "Reinstate Model?",     description: "This will reactivate the model's account and allow them to log in again.",                actionLabel: "Yes, Reinstate", actionClass: "bg-gold-gradient text-primary-foreground hover:opacity-90" },
  };

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Manage Models"
          description={`${models.length} total model${models.length !== 1 ? "s" : ""} registered`}
        />

        {/* Status tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: "all",              label: "All"       },
            { key: "PENDING_APPROVAL", label: "Pending"   },
            { key: "ACTIVE",           label: "Active"    },
            { key: "SUSPENDED",        label: "Suspended" },
            { key: "REJECTED",         label: "Rejected"  },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                statusFilter === key
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border text-muted-foreground hover:border-gold/30 hover:text-foreground"
              )}>
              {label}
              <span className={cn(
                "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                statusFilter === key ? "bg-gold text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}>
                {counts[key === "all" ? "all" : key]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, city or state..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border focus:border-gold" />
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No models found"
            description={search || statusFilter !== "all" ? "Try adjusting your search or filter." : "No models registered yet."} />
        ) : (
          <div className="space-y-3">
            {filtered.map((model) => {
              const config     = STATUS_CONFIG[model.status];
              const StatusIcon = config.icon;
              return (
                <div key={model.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className={cn("h-0.5",
                    model.status === "ACTIVE"           ? "bg-gold-gradient"  :
                    model.status === "PENDING_APPROVAL" ? "bg-amber-500"      :
                    model.status === "SUSPENDED"        ? "bg-orange-500"     : "bg-destructive"
                  )} />
                  <div className="p-4 flex items-start gap-4">
                    <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden border border-border bg-secondary">
                      <img src={model.profilePictureUrl} alt={model.user.fullName} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-semibold text-foreground">
                            {model.user.fullName}
                            {model.user.nickname && (
                              <span className="text-muted-foreground font-normal text-sm ml-1">"{model.user.nickname}"</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{model.user.email}</p>
                        </div>
                        <Badge variant="outline" className={cn("shrink-0 gap-1 text-xs", config.className)}>
                          <StatusIcon className="h-3 w-3" />{config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {model.city && model.state ? `${model.city}, ${model.state}` : "Location not set"}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {model.documents.length} doc{model.documents.length !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />{model._count.faceReveals} reveals
                        </span>
                        <span className="flex items-center gap-1">
                          <Images className="h-3 w-3" />{model.gallery.length} photos
                        </span>
                        <span>
                          {new Date(model.user.createdAt).toLocaleDateString("en-NG", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </span>
                      </div>
                      {model.documents.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap pt-0.5">
                          {model.documents.map((doc) => (
                            <Badge key={doc.id} variant="outline" className="text-[10px] px-1.5 py-0 border-gold/20 text-gold">
                              {DOC_LABELS[doc.documentType] ?? doc.documentType}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Two buttons: View + Edit */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button size="sm" onClick={() => openDetail(model)}
                        className={cn("text-xs h-8",
                          model.status === "PENDING_APPROVAL"
                            ? "bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
                            : "")}
                        variant={model.status === "PENDING_APPROVAL" ? "default" : "outline"}>
                        {model.status === "PENDING_APPROVAL" ? "Review" : "View"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(model)}
                        className="text-xs h-8 border-gold/30 text-gold hover:bg-gold/10 gap-1">
                        <Pencil className="h-3 w-3" />Edit
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ModelDetailModal
        model={selectedModel}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAction={handleAction}
        onEdit={() => openEdit(selectedModel!)}
      />

      <AdminEditModal
        model={selectedModel}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onRefresh={() => router.refresh()}
      />

      {confirmAction && (
        <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>{ACTION_CONFIG[confirmAction.action].title}</AlertDialogTitle>
              <AlertDialogDescription>{ACTION_CONFIG[confirmAction.action].description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executeAction} disabled={actionLoading}
                className={cn("font-semibold", ACTION_CONFIG[confirmAction.action].actionClass)}>
                {actionLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : ACTION_CONFIG[confirmAction.action].actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}