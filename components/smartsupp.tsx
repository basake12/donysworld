"use client";

import { useEffect, useRef, useState } from "react";

export default function Smartsupp() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 24, y: 24 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const _smartsupp = (window as any)._smartsupp || {};
    (window as any)._smartsupp = _smartsupp;
    _smartsupp.key = "261f14fe96a46a6639d799bf91eb91f0766815c3";

    const s = document.getElementsByTagName("script")[0];
    const c = document.createElement("script");
    c.type = "text/javascript";
    c.charset = "utf-8";
    c.async = true;
    c.src = "https://www.smartsuppchat.com/loader.js?";
    s.parentNode?.insertBefore(c, s);
  }, []);

  // ── Mouse ───────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragging.current) return;
    setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
  }

  function onMouseUp() {
    dragging.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  // ── Touch ───────────────────────────────────────
  function onTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    dragging.current = true;
    offset.current = { x: touch.clientX - pos.x, y: touch.clientY - pos.y };
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
  }

  function onTouchMove(e: TouchEvent) {
    if (!dragging.current) return;
    e.preventDefault(); // prevents page scroll while dragging
    const touch = e.touches[0];
    setPos({ x: touch.clientX - offset.current.x, y: touch.clientY - offset.current.y });
  }

  function onTouchEnd() {
    dragging.current = false;
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
  }

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      style={{ left: pos.x, bottom: pos.y }}
      className="fixed z-[9998] cursor-grab active:cursor-grabbing select-none touch-none"
    />
  );
}