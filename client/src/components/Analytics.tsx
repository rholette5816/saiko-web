import { useEffect } from "react";

/*
  Loads GA4 and Meta Pixel only when their env vars are present.

  Set these in your Vercel project settings (and local .env):
    VITE_GA4_ID      = G-XXXXXXXXXX
    VITE_META_PIXEL  = 0000000000000000
*/

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

const GA_ID = import.meta.env.VITE_GA4_ID as string | undefined;
const FB_PIXEL = import.meta.env.VITE_META_PIXEL as string | undefined;

function injectScript(src: string, async = true) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.src = src;
  s.async = async;
  document.head.appendChild(s);
}

export function Analytics() {
  useEffect(() => {
    if (GA_ID) {
      injectScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        window.dataLayer!.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", GA_ID);
    }

    if (FB_PIXEL) {
      (function (f: any, b, e, v, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      window.fbq?.("init", FB_PIXEL);
      window.fbq?.("track", "PageView");
    }
  }, []);

  return null;
}
