"use client";

import { useEffect } from "react";
import { isPortraitCompositionDevice, isTruePhone, requestPhonePortraitLock } from "../lib/phonePortrait";

export function PhonePortraitGuard() {
  useEffect(() => {
    const landscape = window.matchMedia("(orientation: landscape)");
    const syncPortraitCanvas = () => {
      const visual = window.visualViewport;
      const visualWidth = visual?.width ?? window.innerWidth;
      const visualHeight = visual?.height ?? window.innerHeight;
      const root = document.documentElement;
      root.style.setProperty("--aiasap-visual-width", `${visualWidth}px`);
      root.style.setProperty("--aiasap-visual-height", `${visualHeight}px`);
      root.style.setProperty("--aiasap-visual-offset-left", `${visual?.offsetLeft ?? 0}px`);
      root.style.setProperty("--aiasap-visual-offset-top", `${visual?.offsetTop ?? 0}px`);
      const eligible = isPortraitCompositionDevice(navigator, screen);
      const isLandscape = landscape.matches || visualWidth > visualHeight;
      const phone = isTruePhone(navigator) || Math.min(screen.width, screen.height) <= 600;
      root.classList.toggle("aiasap-phone-device", eligible && phone);
      root.classList.toggle("aiasap-tablet-device", eligible && !phone);
      root.classList.toggle("aiasap-mobile-portrait-canvas", eligible && isLandscape);
      root.classList.toggle("aiasap-phone-portrait-canvas", eligible && isLandscape && phone);
    };
    const requestLock = () => {
      void requestPhonePortraitLock(navigator, screen);
    };

    syncPortraitCanvas();
    landscape.addEventListener("change", syncPortraitCanvas);
    window.addEventListener("resize", syncPortraitCanvas);
    window.addEventListener("orientationchange", syncPortraitCanvas);
    window.visualViewport?.addEventListener("resize", syncPortraitCanvas);
    window.addEventListener("pointerup", requestLock, { capture: true });
    window.addEventListener("keyup", requestLock, { capture: true });

    return () => {
      landscape.removeEventListener("change", syncPortraitCanvas);
      window.removeEventListener("resize", syncPortraitCanvas);
      window.removeEventListener("orientationchange", syncPortraitCanvas);
      window.visualViewport?.removeEventListener("resize", syncPortraitCanvas);
      window.removeEventListener("pointerup", requestLock, { capture: true });
      window.removeEventListener("keyup", requestLock, { capture: true });
      document.documentElement.classList.remove("aiasap-mobile-portrait-canvas");
      document.documentElement.classList.remove("aiasap-phone-portrait-canvas");
      document.documentElement.classList.remove("aiasap-phone-device");
      document.documentElement.classList.remove("aiasap-tablet-device");
      document.documentElement.style.removeProperty("--aiasap-visual-width");
      document.documentElement.style.removeProperty("--aiasap-visual-height");
      document.documentElement.style.removeProperty("--aiasap-visual-offset-left");
      document.documentElement.style.removeProperty("--aiasap-visual-offset-top");
    };
  }, []);

  return null;
}
