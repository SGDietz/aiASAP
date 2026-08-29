type NavigatorWithMobileHint = Navigator & {
  userAgentData?: { mobile?: boolean };
};

type LockableScreen = Screen & {
  orientation?: ScreenOrientation & {
    lock?: (orientation: "portrait-primary") => Promise<void>;
  };
};

export function isTruePhone(navigatorLike: NavigatorWithMobileHint): boolean {
  if (navigatorLike.userAgentData?.mobile === true) return true;

  const userAgent = navigatorLike.userAgent;
  if (/iPhone|iPod/i.test(userAgent)) return true;
  return /Android/i.test(userAgent) && /Mobile/i.test(userAgent);
}

export async function requestPhonePortraitLock(
  navigatorLike: NavigatorWithMobileHint,
  screenLike: LockableScreen,
): Promise<boolean> {
  if (!isTruePhone(navigatorLike)) return false;

  const lock = screenLike.orientation?.lock;
  if (typeof lock !== "function") return false;

  try {
    await lock.call(screenLike.orientation, "portrait-primary");
    return true;
  } catch {
    // iPhone Safari and ordinary non-fullscreen tabs commonly reject locking.
    // The visible landscape guard remains the honest fallback.
    return false;
  }
}
