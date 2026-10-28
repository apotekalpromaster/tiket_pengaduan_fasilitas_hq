'use client';
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void };
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Cloudflare Turnstile (anti-spam). Tidak tampil bila site key kosong. */
export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (t: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey || !box.current) return;
    let id: string | undefined, cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || !box.current) return;
      id = window.turnstile.render(box.current, {
        sitekey: siteKey, language: 'id', appearance: 'interaction-only',
        callback: (t: string) => onToken(t), 'expired-callback': () => onToken(null), 'error-callback': () => onToken(null),
      });
    };
    if (window.turnstile) render();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
      if (!s) { s = document.createElement('script'); s.src = SRC; s.async = true; document.head.appendChild(s); }
      s.addEventListener('load', render);
    }
    return () => { cancelled = true; if (id && window.turnstile) window.turnstile.remove(id); };
  }, [siteKey, onToken]);
  return siteKey ? <div ref={box} /> : null;
}
