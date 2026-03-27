"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Separator } from "@/components/ui/separator";
import {
  ShieldCheck,
  ShieldX,
  Search,
  Eye,
  FileText,
  User,
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
} from "lucide-react";
import { formatCoins } from "@/lib/coins";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

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
  user: {
    id: string;
    fullName: string;
    email: string;
    whatsappNumber: string;
    gender: string;
    createdAt: string;
  };
  documents: ModelDocument[];
  charges: ModelCharge[];
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
  SHORT: "Short Meet · 1hr",
  OVERNIGHT: "Overnight · 3hrs",
  WEEKEND: "Weekend · 48hrs",
} as const;

const DOC_LABELS: Record<string, string> = {
  NIN: "NIN",
  DRIVERS_LICENSE: "Driver's License",
  VOTERS_CARD: "Voter's Card",
  INTERNATIONAL_PASSPORT: "Int'l Passport",
};

// ─────────────────────────────────────────────
// MODEL DETAIL MODAL
// ─────────────────────────────────────────────

function ModelDetailModal({
  model,
  open,
  onClose,
  onAction,
}: {
  model: Model | null;
  open: boolean;
  onClose: () => void;
  onAction: (
    modelId: string,
    profileId: string,
    action: "approve" | "reject" | "suspend" | "unsuspend"
  ) => void;
}) {
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  if (!model) return null;

  const config = STATUS_CONFIG[model.status];
  const StatusIcon = config.icon;

  async function viewDocument(docPath: string) {
    setLoadingDoc(true);
    try {
      const res = await fetch(
        `/api/admin/document-url?path=${encodeURIComponent(docPath)}`
      );
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
          {/* Gold accent */}
          <div className="h-0.5 w-full bg-gold-gradient rounded-full" />

          {/* Profile header */}
          <div className="flex items-start gap-4">
            <div className="relative h-20 w-20 shrink-0 rounded-xl overflow-hidden border border-border bg-secondary">
              <img
                src={model.profilePictureUrl}
                alt={model.user.fullName}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground text-lg">
                  {model.user.fullName}
                </h3>
                <Badge
                  variant="outline"
                  className={cn("text-xs gap-1", config.className)}
                >
                  <StatusIcon className="h-3 w-3" />
                  {config.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {model.user.email}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {model.user.whatsappNumber}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Joined{" "}
                {new Date(model.user.createdAt).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Profile details */}
          <div className="rounded-xl border border-border bg-secondary p-4 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Profile Details
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Age: </span>
                <span className="text-foreground font-medium">
                  {model.age || "Not set"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Height: </span>
                <span className="text-foreground font-medium">
                  {model.height || "Not set"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Body: </span>
                <span className="text-foreground font-medium">
                  {model.bodyType || "Not set"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Complexion: </span>
                <span className="text-foreground font-medium">
                  {model.complexion || "Not set"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location:{" "}
                </span>
                <span className="text-foreground font-medium">
                  {model.city && model.state
                    ? `${model.city}, ${model.state}`
                    : "Not set"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Gender: </span>
                <span className="text-foreground font-medium">
                  {model.user.gender}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Face Reveals: </span>
                <span className="text-gold font-medium">
                  {model._count.faceReveals}
                </span>
              </div>
            </div>

            {model.about && (
              <>
                <Separator className="bg-border/50" />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">About</p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {model.about}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Charges */}
          {model.charges.length > 0 && (
            <div className="rounded-xl border border-border bg-secondary p-4 space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Charges
              </p>
              <div className="space-y-1.5">
                {model.charges.map((charge) => (
                  <div
                    key={charge.meetType}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {MEET_LABELS[charge.meetType]}
                    </span>
                    <div className="flex items-center gap-1 text-gold font-medium">
                      <Coins className="h-3 w-3" />
                      {formatCoins(charge.minCoins)} –{" "}
                      {formatCoins(charge.maxCoins)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legal documents */}
          <div className="rounded-xl border border-border bg-secondary p-4 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Legal Documents
            </p>
            {model.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No documents uploaded
              </p>
            ) : (
              <div className="space-y-2">
                {model.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gold" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {DOC_LABELS[doc.documentType] ?? doc.documentType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded{" "}
                          {new Date(doc.uploadedAt).toLocaleDateString(
                            "en-NG",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewDocument(doc.documentUrl)}
                      disabled={loadingDoc}
                      className="border-gold/30 text-gold hover:bg-gold/10 gap-1.5 h-8 text-xs"
                    >
                      {loadingDoc ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3 w-3" />
                      )}
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            {model.status === "PENDING_APPROVAL" && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() =>
                    onAction(model.user.id, model.id, "reject")
                  }
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() =>
                    onAction(model.user.id, model.id, "approve")
                  }
                  className="bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
            )}

            {model.status === "ACTIVE" && (
              <Button
                variant="outline"
                onClick={() =>
                  onAction(model.user.id, model.id, "suspend")
                }
                className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              >
                <Ban className="mr-2 h-4 w-4" />
                Suspend Model
              </Button>
            )}

            {model.status === "SUSPENDED" && (
              <Button
                onClick={() =>
                  onAction(model.user.id, model.id, "unsuspend")
                }
                className="w-full bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Reinstate Model
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const initialFilter = searchParams.get("filter") ?? "all";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    initialFilter === "pending" ? "PENDING_APPROVAL" : "all"
  );
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    modelUserId: string;
    profileId: string;
    action: "approve" | "reject" | "suspend" | "unsuspend";
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── FILTER ───────────────────────────────────
  const filtered = useMemo(() => {
    return models.filter((m) => {
      const matchesSearch =
        search === "" ||
        m.user.fullName.toLowerCase().includes(search.toLowerCase()) ||
        m.user.email.toLowerCase().includes(search.toLowerCase()) ||
        m.city.toLowerCase().includes(search.toLowerCase()) ||
        m.state.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || m.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [models, search, statusFilter]);

  // ── STATUS COUNTS ─────────────────────────────
  const counts = useMemo(
    () => ({
      all: models.length,
      PENDING_APPROVAL: models.filter(
        (m) => m.status === "PENDING_APPROVAL"
      ).length,
      ACTIVE: models.filter((m) => m.status === "ACTIVE").length,
      SUSPENDED: models.filter((m) => m.status === "SUSPENDED").length,
      REJECTED: models.filter((m) => m.status === "REJECTED").length,
    }),
    [models]
  );

  function openDetail(model: Model) {
    setSelectedModel(model);
    setDetailOpen(true);
  }

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
      const res = await fetch("/api/admin/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmAction),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      const labels: Record<string, string> = {
        approve: "Model approved and activated",
        reject: "Model application rejected",
        suspend: "Model account suspended",
        unsuspend: "Model account reinstated",
      };

      toast({ title: labels[confirmAction.action] });
      setConfirmAction(null);
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }

  const ACTION_CONFIG = {
    approve: {
      title: "Approve Model?",
      description:
        "This will activate the model's account and allow them to receive offers from clients.",
      actionLabel: "Yes, Approve",
      actionClass:
        "bg-gold-gradient text-primary-foreground hover:opacity-90",
    },
    reject: {
      title: "Reject Application?",
      description:
        "This will reject the model's application. They will not be able to log in.",
      actionLabel: "Yes, Reject",
      actionClass: "bg-destructive text-destructive-foreground",
    },
    suspend: {
      title: "Suspend Model?",
      description:
        "This will prevent the model from logging in and receiving new offers.",
      actionLabel: "Yes, Suspend",
      actionClass: "bg-orange-500 text-white hover:bg-orange-600",
    },
    unsuspend: {
      title: "Reinstate Model?",
      description:
        "This will reactivate the model's account and allow them to log in again.",
      actionLabel: "Yes, Reinstate",
      actionClass:
        "bg-gold-gradient text-primary-foreground hover:opacity-90",
    },
  };

  return (
    <>
      <div className="space-y-6">
        {/* ── HEADER ──────────────────────────── */}
        <PageHeader
          title="Manage Models"
          description={`${models.length} total model${models.length !== 1 ? "s" : ""} registered`}
        />

        {/* ── STATUS TABS ─────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { key: "all", label: "All" },
              { key: "PENDING_APPROVAL", label: "Pending" },
              { key: "ACTIVE", label: "Active" },
              { key: "SUSPENDED", label: "Suspended" },
              { key: "REJECTED", label: "Rejected" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                statusFilter === key
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border text-muted-foreground hover:border-gold/30 hover:text-foreground"
              )}
            >
              {label}
              <span
                className={cn(
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  statusFilter === key
                    ? "bg-gold text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {counts[key === "all" ? "all" : key]}
              </span>
            </button>
          ))}
        </div>

        {/* ── SEARCH ──────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, city or state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border focus:border-gold"
          />
        </div>

        {/* ── RESULTS ─────────────────────────── */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No models found"
            description={
              search || statusFilter !== "all"
                ? "Try adjusting your search or filter."
                : "No models registered yet."
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((model) => {
              const config = STATUS_CONFIG[model.status];
              const StatusIcon = config.icon;

              return (
                <div
                  key={model.id}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <div
                    className={cn(
                      "h-0.5",
                      model.status === "ACTIVE"
                        ? "bg-gold-gradient"
                        : model.status === "PENDING_APPROVAL"
                        ? "bg-amber-500"
                        : model.status === "SUSPENDED"
                        ? "bg-orange-500"
                        : "bg-destructive"
                    )}
                  />

                  <div className="p-4 flex items-start gap-4">
                    {/* Profile picture — unblurred for admin */}
                    <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden border border-border bg-secondary">
                      <img
                        src={model.profilePictureUrl}
                        alt={model.user.fullName}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-semibold text-foreground">
                            {model.user.fullName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {model.user.email}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 gap-1 text-xs",
                            config.className
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {model.city && model.state
                            ? `${model.city}, ${model.state}`
                            : "Location not set"}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {model.documents.length} doc
                          {model.documents.length !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {model._count.faceReveals} reveals
                        </span>
                        <span>
                          {new Date(
                            model.user.createdAt
                          ).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {/* Doc badges */}
                      {model.documents.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap pt-0.5">
                          {model.documents.map((doc) => (
                            <Badge
                              key={doc.id}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-gold/20 text-gold"
                            >
                              {DOC_LABELS[doc.documentType] ??
                                doc.documentType}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Review button */}
                    <Button
                      size="sm"
                      onClick={() => openDetail(model)}
                      className={cn(
                        "shrink-0 text-xs h-8",
                        model.status === "PENDING_APPROVAL"
                          ? "bg-gold-gradient text-primary-foreground font-semibold hover:opacity-90"
                          : "variant-outline border-border text-muted-foreground hover:text-foreground"
                      )}
                      variant={
                        model.status === "PENDING_APPROVAL"
                          ? "default"
                          : "outline"
                      }
                    >
                      {model.status === "PENDING_APPROVAL"
                        ? "Review"
                        : "View"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DETAIL MODAL ──────────────────────── */}
      <ModelDetailModal
        model={selectedModel}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAction={handleAction}
      />

      {/* ── CONFIRM DIALOG ────────────────────── */}
      {confirmAction && (
        <AlertDialog
          open={!!confirmAction}
          onOpenChange={(open) => {
            if (!open) setConfirmAction(null);
          }}
        >
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {ACTION_CONFIG[confirmAction.action].title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {ACTION_CONFIG[confirmAction.action].description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={executeAction}
                disabled={actionLoading}
                className={cn(
                  "font-semibold",
                  ACTION_CONFIG[confirmAction.action].actionClass
                )}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  ACTION_CONFIG[confirmAction.action].actionLabel
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}