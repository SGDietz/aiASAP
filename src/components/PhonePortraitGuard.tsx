"use client";

import { useEffect, useState } from "react";
import { isTruePhone, requestPhonePortraitLock } from "../lib/phonePortrait";

export function PhonePortraitGuard() {
  const [showGuard, setShowGuard] = useState(false);

  useEffect(() => {
    if (!isTruePhone(navigator)) return;

    const landscape = window.matchMedia("(orientation: landscape)");
    const syncGuard = () => setShowGuard(landscape.matches);
    const requestLock = () => {
      void requestPhonePortraitLock(navigator, screen);
    };

    syncGuard();
    landscape.addEventListener("change", syncGuard);
    window.addEventListener("pointerup", requestLock, { capture: true });
    window.addEventListener("keyup", requestLock, { capture: true });

    return () => {
      landscape.removeEventListener("change", syncGuard);
      window.removeEventListener("pointerup", requestLock, { capture: true });
      window.removeEventListener("keyup", requestLock, { capture: true });
    };
  }, []);

  if (!showGuard) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-phone-portrait-guard="1"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[radial-gradient(135%_110%_at_50%_32%,#5a360f_0%,#3a220c_45%,#190f05_100%)] px-8 text-center"
    >
      <div className="max-w-sm font-semibold text-[#d7a05a] drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]">
        <div className="text-3xl font-black italic">aiASAP</div>
        <p className="mt-4 text-lg">Please rotate your phone to portrait.</p>
      </div>
    </div>
  );
}
