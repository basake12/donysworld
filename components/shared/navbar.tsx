"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Session } from "next-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Wallet,
  Users,
  Bell,
  LogOut,
  Menu,
  HandCoins,
  UserCircle,
  ShieldCheck,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// NAV LINKS PER ROLE
// ─────────────────────────────────────────────

const CLIENT_LINKS = [
  { href: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client/models", label: "Browse Models", icon: Users },
  { href: "/client/offers", label: "My Offers", icon: HandCoins },
  { href: "/client/wallet", label: "Wallet", icon: Wallet },
];

const MODEL_LINKS = [
  { href: "/model/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/model/profile", label: "My Profile", icon: UserCircle },
  { href: "/model/offers", label: "Offers", icon: HandCoins },
  { href: "/model/wallet", label: "Wallet", icon: Wallet },
];

const ADMIN_LINKS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/models", label: "Models", icon: ShieldCheck },
  { href: "/admin/fund-requests", label: "Fund Requests", icon: Wallet },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: HandCoins },
  { href: "/admin/wallet", label: "Wallet", icon: Coins },
];

const ROLE_LINKS = {
  CLIENT: CLIENT_LINKS,
  MODEL: MODEL_LINKS,
  ADMIN: ADMIN_LINKS,
};

const ROLE_BADGE_STYLES = {
  CLIENT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  MODEL: "bg-gold/10 text-gold border-gold/20",
  ADMIN: "bg-red-500/10 text-red-400 border-red-500/20",
};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface NavbarProps {
  session: Session;
  notificationCount?: number;
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export function Navbar({ session, notificationCount = 0 }: NavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = session.user.role as "CLIENT" | "MODEL" | "ADMIN";
  const links = ROLE_LINKS[role] ?? CLIENT_LINKS;
  const initials = session.user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-gold/10 text-gold border border-gold/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* ── LEFT: Logo + Desktop nav ─────────── */}
        <div className="flex items-center gap-6">
          <Link
            href={`/${role.toLowerCase()}/dashboard`}
            className="flex items-center gap-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 border border-gold/20">
              <Coins className="h-4 w-4 text-gold" />
            </div>
            <span className="font-bold text-gold-gradient tracking-wide hidden sm:block">
              Dony&apos;s World
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLinks />
          </nav>
        </div>

        {/* ── RIGHT: Actions ───────────────────── */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <Link
            href={`/${role.toLowerCase()}/notifications`}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-gold/40 transition-all"
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-primary-foreground">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Link>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                suppressHydrationWarning
                className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-2 py-1.5 hover:border-gold/40 transition-all"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-gold/20 text-gold text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-sm font-medium text-foreground max-w-[120px] truncate">
                  {session.user.name}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="space-y-1">
                <p className="text-sm font-medium truncate">
                  {session.user.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {session.user.email}
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0 mt-1",
                    ROLE_BADGE_STYLES[role]
                  )}
                >
                  {role}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {role === "MODEL" && (
                <DropdownMenuItem asChild>
                  <Link href="/model/profile" className="cursor-pointer">
                    <UserCircle className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
              )}
              {role === "CLIENT" && (
                <DropdownMenuItem asChild>
                  <Link href="/client/wallet" className="cursor-pointer">
                    <Wallet className="mr-2 h-4 w-4" />
                    My Wallet
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                suppressHydrationWarning
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-card border-border p-0">
              <div className="flex flex-col h-full">
                {/* Mobile header */}
                <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 border border-gold/20">
                    <Coins className="h-4 w-4 text-gold" />
                  </div>
                  <span className="font-bold text-gold-gradient">
                    Dony&apos;s World
                  </span>
                </div>

                {/* Mobile nav */}
                <nav className="flex flex-col gap-1 p-3 flex-1">
                  <NavLinks onNavigate={() => setMobileOpen(false)} />
                </nav>

                {/* Mobile sign out */}
                <div className="border-t border-border p-3">
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}