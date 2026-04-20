"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";

type Status =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "success"; newEmail: string }
  | { kind: "error"; message: string };

export default function VerifyEmailChangePage() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token");

  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // If there's no token in the URL, render the error state immediately.
  useEffect(() => {
    if (!token) setStatus({ kind: "error", message: "No confirmation token in URL" });
  }, [token]);

  async function handleConfirm() {
    if (!token) return;
    setStatus({ kind: "verifying" });
    try {
      const res = await fetch("/api/auth/verify-email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setStatus({ kind: "success", newEmail: data.newEmail });
      // Gentle redirect after 3s — user can also click the button.
      setTimeout(() => router.push("/model/profile"), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Verification failed";
      setStatus({ kind: "error", message: msg });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 space-y-6">
        <div className="h-0.5 -mt-8 -mx-8 mb-6 rounded-t-2xl bg-gold-gradient" />

        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 border border-gold/30">
            {status.kind === "success"
              ? <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              : status.kind === "error"
              ? <XCircle className="h-6 w-6 text-destructive" />
              : <Mail className="h-6 w-6 text-gold" />}
          </div>
        </div>

        {status.kind === "idle" && (
          <>
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-black text-foreground">Confirm email change</h1>
              <p className="text-sm text-muted-foreground">
                Click the button below to switch your account email. This action cannot be undone.
              </p>
            </div>
            <Button
              onClick={handleConfirm}
              className="w-full h-11 bg-gold-gradient text-primary-foreground font-semibold"
              disabled={!token}
            >
              Confirm New Email
            </Button>
          </>
        )}

        {status.kind === "verifying" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 text-gold animate-spin" />
            <p className="text-sm text-muted-foreground">Verifying...</p>
          </div>
        )}

        {status.kind === "success" && (
          <>
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-black text-foreground">Email changed!</h1>
              <p className="text-sm text-muted-foreground">
                Your account email is now{" "}
                <span className="font-bold text-gold break-all">{status.newEmail}</span>.
              </p>
              <p className="text-xs text-muted-foreground">
                Redirecting you to your profile...
              </p>
            </div>
            <Link
              href="/model/profile"
              className="flex items-center justify-center h-11 rounded-xl bg-gold-gradient text-primary-foreground font-semibold"
            >
              Go to Profile
            </Link>
          </>
        )}

        {status.kind === "error" && (
          <>
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-black text-foreground">Couldn&rsquo;t verify</h1>
              <p className="text-sm text-destructive">{status.message}</p>
              <p className="text-xs text-muted-foreground">
                The link may have expired or already been used. You can request a new one from your profile.
              </p>
            </div>
            <Link
              href="/model/profile"
              className="flex items-center justify-center h-11 rounded-xl border border-border bg-secondary text-foreground font-semibold hover:bg-secondary/80"
            >
              Back to Profile
            </Link>
          </>
        )}
      </div>
    </div>
  );
}