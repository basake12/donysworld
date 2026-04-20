"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Session } from "next-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard, Wallet, Users, Bell, LogOut, Menu, HandCoins,
  UserCircle, ShieldCheck, Coins, Sun, Moon, ShieldX, ImageOff,
} from "lucide-react";
import { ModelIcon } from "@/components/shared/model-icon";
import { cn } from "@/lib/utils";

// ─── NAV LINKS ──────────────────────────────────

const CLIENT_LINKS = [
  { href: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client/models",    label: "Browse",    icon: Users },
  { href: "/client/offers",    label: "My Offers", icon: HandCoins },
  { href: "/client/wallet",    label: "Wallet",    icon: Wallet },
];

const MODEL_LINKS = [
  { href: "/model/dashboard",  label: "Dashboard", icon: LayoutDashboard },
  { href: "/model/profile",    label: "Profile",   icon: UserCircle },
  { href: "/model/offers",     label: "Offers",    icon: HandCoins },
  { href: "/model/wallet",     label: "Wallet",    icon: Wallet },
  { href: "/model/blocklist",  label: "Blocklist", icon: ShieldX },
];

const ADMIN_LINKS = [
  { href: "/admin/dashboard",     label: "Dashboard",   icon: LayoutDashboard },
  { href: "/admin/models",        label: "Models",      icon: ShieldCheck },
  { href: "/admin/fund-requests", label: "Funds",       icon: Wallet },
  { href: "/admin/withdrawals",   label: "Withdrawals", icon: HandCoins },
  { href: "/admin/wallet",        label: "Wallet",      icon: Coins },
  { href: "/admin/backfill",      label: "Backfill",    icon: ImageOff },
];

const ROLE_LINKS = { CLIENT: CLIENT_LINKS, MODEL: MODEL_LINKS, ADMIN: ADMIN_LINKS };

const ROLE_BADGE_STYLES = {
  CLIENT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  MODEL:  "bg-gold/10 text-gold border-gold/20",
  ADMIN:  "bg-red-500/10 text-red-400 border-red-500/20",
};

interface NavbarProps {
  session: Session;
  notificationCount?: number;
}

export function Navbar({ session, notificationCount = 0 }: NavbarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  // ✅ FIX: Prevents hydration mismatch — theme is undefined on the server,
  // so we defer icon rendering until after the client has mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const role     = session.user.role as "CLIENT" | "MODEL" | "ADMIN";
  const links    = ROLE_LINKS[role] ?? CLIENT_LINKS;
  const initials = session.user.name
    ?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

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
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200",
                active
                  ? "bg-gold/10 text-gold border border-gold/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
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
    <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 md:px-6 gap-3">

        {/* Logo + Desktop nav */}
        <div className="flex items-center gap-5">
          <Link href={`/${role.toLowerCase()}/dashboard`} className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/12 border border-gold/25">
              <ModelIcon className="h-4 w-4 text-gold" />
            </div>
            <span className="font-black text-gold-gradient tracking-wide hidden sm:block font-playfair text-lg">
              Dony&apos;s World
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <NavLinks />
          </nav>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">

          {/* ✅ FIX: Theme toggle — render icon only after mount to avoid SSR mismatch.
              A consistent placeholder (Sun) is shown during SSR so both sides agree. */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-gold/40 transition-all"
            suppressHydrationWarning
            aria-label="Toggle theme"
          >
            {mounted ? (
              theme === "dark" ? (
                <Sun className="h-4 w-4 text-gold" />
              ) : (
                <Moon className="h-4 w-4 text-gold" />
              )
            ) : (
              // Stable placeholder rendered on both server and client until mounted
              <Sun className="h-4 w-4 text-gold" />
            )}
          </button>

          {/* Notifications */}
          <Link
            href={`/${role.toLowerCase()}/notifications`}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-gold/40 transition-all"
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-black text-black">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Link>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                suppressHydrationWarning
                className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-2.5 py-1.5 hover:border-gold/40 transition-all"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-gold/20 text-gold text-xs font-black">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-xs font-semibold text-foreground max-w-[100px] truncate">
                  {session.user.name}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              <DropdownMenuLabel className="space-y-1 py-3">
                <p className="text-sm font-bold truncate">{session.user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 mt-1 rounded-full", ROLE_BADGE_STYLES[role])}>
                  {role}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {role === "MODEL" && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/model/profile" className="cursor-pointer gap-2 rounded-xl">
                      <UserCircle className="h-4 w-4" />My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/model/blocklist" className="cursor-pointer gap-2 rounded-xl">
                      <ShieldX className="h-4 w-4" />Blocklist
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              {role === "CLIENT" && (
                <DropdownMenuItem asChild>
                  <Link href="/client/wallet" className="cursor-pointer gap-2 rounded-xl">
                    <Wallet className="h-4 w-4" />My Wallet
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-destructive focus:text-destructive cursor-pointer gap-2 rounded-xl"
              >
                <LogOut className="h-4 w-4" />Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button suppressHydrationWarning variant="ghost" size="icon"
                className="md:hidden h-9 w-9 rounded-xl">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-card border-border p-0">
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/12 border border-gold/25">
                    <ModelIcon className="h-4 w-4 text-gold" />
                  </div>
                  <span className="font-black text-gold-gradient font-playfair">Dony&apos;s World</span>
                </div>
                <nav className="flex flex-col gap-1 p-3 flex-1">
                  <NavLinks onNavigate={() => setMobileOpen(false)} />
                </nav>
                <div className="border-t border-border p-3">
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/8 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />Sign Out
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