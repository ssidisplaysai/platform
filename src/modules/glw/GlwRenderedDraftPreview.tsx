"use client";

import React, { useEffect, useRef, useState } from "react";

type Mode = "DESKTOP" | "MOBILE";

export function GlwRenderedDraftPreview({ html, baseUrl, label }: { html: string; baseUrl: string | null; label: string }) {
  const [mode, setMode] = useState<Mode>("DESKTOP");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const viewportWidth = mode === "DESKTOP" ? 1440 : 375;
  const [metrics, setMetrics] = useState({ viewport: viewportWidth, content: 0 });
  const utilization = metrics.content > 0 ? Math.round((metrics.content / metrics.viewport) * 100) : 0;
  const source = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${baseUrl ? `<base href="${baseUrl}">` : ""}<style>*{box-sizing:border-box}html{background:#fff;color:#18181b;font-family:Georgia,serif}body{margin:0 auto;max-width:1180px;padding:32px;line-height:1.65}img{display:block;max-width:100%;height:auto;margin:24px auto}h1,h2,h3{font-family:Arial,sans-serif;line-height:1.18}h1{font-size:clamp(32px,5vw,60px)}h2{margin-top:42px;font-size:28px}a{color:#b91c1c}@media(max-width:600px){body{padding:20px}h2{font-size:23px}}</style></head><body>${html}</body></html>`;

  function measure(frame: HTMLIFrameElement) {
    const document = frame.contentDocument;
    if (!document?.documentElement || !document.body) return;
    setMetrics({ viewport: window.innerWidth, content: Math.round(document.body.getBoundingClientRect().width) });
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (frameRef.current) measure(frameRef.current);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [mode, html, baseUrl]);

  return <div className="min-w-0 max-w-full">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-800 pb-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-red-400">{label}</p>
        <p className="mt-1 text-xs text-zinc-500">Authenticated content snapshot. WordPress theme chrome is not embedded.</p>
      </div>
      <div className="flex border border-zinc-700" aria-label={`${label} viewport`}>
        {(["DESKTOP", "MOBILE"] as const).map((item) => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)} className={`px-3 py-2 text-xs font-semibold ${mode === item ? "bg-zinc-100 text-zinc-950" : "text-zinc-400"}`}>{item === "DESKTOP" ? "Desktop" : "Mobile"}</button>)}
      </div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div><p className="text-[11px] uppercase text-zinc-500">Browser viewport</p><p className="mt-1 text-sm text-white">{metrics.viewport}px</p></div>
      <div><p className="text-[11px] uppercase text-zinc-500">Primary content width</p><p className="mt-1 text-sm text-white">{metrics.content > 0 ? `~${metrics.content}px` : "Measuring"}</p></div>
      <div><p className="text-[11px] uppercase text-zinc-500">Viewport utilization</p><p className="mt-1 text-sm text-white">{utilization > 0 ? `~${utilization}%` : "Measuring"}</p></div>
    </div>
    <div className="mt-4 w-full min-w-0 max-w-full overflow-x-auto bg-zinc-950 p-3" style={{ contain: "inline-size" }}>
      <iframe ref={frameRef} key={mode} title={label} srcDoc={source} sandbox="allow-same-origin" onLoad={(event) => measure(event.currentTarget)} className="block min-h-[680px] w-full border-0 bg-white transition-[max-width]" style={{ maxWidth: mode === "MOBILE" ? 375 : "100%" }} />
    </div>
  </div>;
}