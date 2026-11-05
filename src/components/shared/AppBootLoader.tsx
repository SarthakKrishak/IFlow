"use client";

import { useEffect, useState } from "react";
import { IFlowLoader } from "./IFlowLoader";

const KEY = "iflow-booted";
const SHOW_MS = 1400;

/**
 * Full-screen IFlow splash, shown once per browser session on the very first
 * load of the app. In-app navigation never shows it (routes use skeletons).
 *
 * The inline script in the app layout sets `data-booted` on <html> before
 * paint for returning visitors, and CSS hides the overlay — no flash.
 */
export function AppBootLoader() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {
      // storage blocked — splash just plays each full load
    }
    if (seen) {
      setPhase("gone");
      return;
    }
    const fade = setTimeout(() => setPhase("fade"), SHOW_MS);
    const gone = setTimeout(() => setPhase("gone"), SHOW_MS + 450);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;
  return (
    <div
      id="iflow-boot"
      aria-hidden="true"
      className={`fixed inset-0 z-[200] bg-background flex items-center justify-center transition-opacity duration-[450ms] ease-out ${
        phase === "fade" ? "opacity-0" : "opacity-100"
      }`}
    >
      <IFlowLoader />
    </div>
  );
}

/** Runs before first paint: hides the splash for returning visitors in this session. */
export const BOOT_SCRIPT = `try{if(sessionStorage.getItem('${KEY}')==='1')document.documentElement.setAttribute('data-booted','1')}catch(e){}`;
