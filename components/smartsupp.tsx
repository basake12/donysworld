"use client";

import { useEffect } from "react";

export default function Smartsupp() {
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

  return null;
}