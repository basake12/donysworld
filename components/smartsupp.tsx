"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X } from "lucide-react";

const SMARTSUPP_KEY = "261f14fe96a46a6639d799bf91eb91f0766815c3";

declare global {
  interface Window {
    smartsupp?: (...args: unknown[]) => void;
    _smartsupp?: Record<string, unknown>;
  }
}

export default function Smartsupp() {
  const [ready, setReady]       = useState(false);
  const [open, setOpen]         = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const btnRef       = useRef<HTMLButtonElement>(null);
  const dragging     = useRef(false);
  const moved        = useRef(false);
  const touchHandled = useRef(false);
  const offset       = useRef({ x: 0, y: 0 });

  // Start bottom-right, above mobile nav bar
  const [pos, setPos] = useState({ x: 16, y: 80 });

  // ── Detect mobile ─────────────────────────────────────────────────────────
  useEffect(() => {
    setIsMobile(window.matchMedia("(max-width: 768px)").matches);
  }, []);

  // ── Load Smartsupp ────────────────────────────────────────────────────────
  useEffect(() => {
    window._smartsupp             = window._smartsupp ?? {};
    window._smartsupp.key         = SMARTSUPP_KEY;
    window._smartsupp.hideWidget  = true; // hide native button before load

    const s = document.getElementsByTagName("script")[0];
    const c = document.createElement("script");
    c.type    = "text/javascript";
    c.charset = "utf-8";
    c.async   = true;
    c.src     = "https://www.smartsuppchat.com/loader.js?";

    c.onload = () => {
      // Belt-and-suspenders: also call the API to hide after load
      window.smartsupp?.("chat:hide");
      setReady(true);
    };

    s.parentNode?.insertBefore(c, s);
  }, []);

  // ── Toggle chat ───────────────────────────────────────────────────────────
  const toggleChat = useCallback(() => {
    if (!window.smartsupp) return;
    setOpen((prev) => {
      if (prev) {
        window.smartsupp!("chat:close");
        window.smartsupp!("chat:hide");
        return false;
      } else {
        window.smartsupp!("chat:show");
        window.smartsupp!("chat:open");
        return true;
      }
    });
  }, []);

  // ── Mouse drag ────────────────────────────────────────────────────────────
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    moved.current = true;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = btnRef.current?.offsetWidth  ?? 48;
    const bh = btnRef.current?.offsetHeight ?? 48;
    const newX = Math.max(8, Math.min(vw - bw - 8, e.clientX - offset.current.x));
    const newY = Math.max(8, Math.min(vh - bh - 8, e.clientY - offset.current.y));
    setPos({ x: vw - newX - bw, y: vh - newY - bh });
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup",   onMouseUp);
  }, [onMouseMove]);

  function onMouseDown(e: React.MouseEvent) {
    moved.current    = false;
    dragging.current = true;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
  }

  // ── Touch drag ────────────────────────────────────────────────────────────
  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    moved.current = true;
    const touch = e.touches[0];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = btnRef.current?.offsetWidth  ?? 48;
    const bh = btnRef.current?.offsetHeight ?? 48;
    const newX = Math.max(8, Math.min(vw - bw - 8, touch.clientX - offset.current.x));
    const newY = Math.max(8, Math.min(vh - bh - 8, touch.clientY - offset.current.y));
    setPos({ x: vw - newX - bw, y: vh - newY - bh });
  }, []);

  const onTouchEnd = useCallback(() => {
    dragging.current = false;
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend",  onTouchEnd);
    if (!moved.current) {
      touchHandled.current = true;
      toggleChat();
    }
  }, [onTouchMove, toggleChat]);

  function onTouchStart(e: React.TouchEvent) {
    moved.current        = false;
    touchHandled.current = false;
    dragging.current     = true;
    const touch = e.touches[0];
    const rect  = (e.currentTarget as HTMLElement).getBoundingClientRect();
    offset.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend",  onTouchEnd);
  }

  if (!isMobile) return null;

  return (
    <button
      ref={btnRef}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={() => {
        if (touchHandled.current) { touchHandled.current = false; return; }
        if (!moved.current) toggleChat();
      }}
      style={{ position: "fixed", right: pos.x, bottom: pos.y, zIndex: 9997 }}
      className={[
        "flex items-center justify-center",
        "h-12 w-12 rounded-full shadow-xl",
        "cursor-grab active:cursor-grabbing select-none touch-none",
        "transition-colors duration-200",
        open ? "bg-destructive text-white" : "bg-gold-gradient text-black",
        !ready && "opacity-40 pointer-events-none",
      ].filter(Boolean).join(" ")}
      aria-label={open ? "Close chat" : "Open chat"}
    >
      {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
    </button>
  );
}