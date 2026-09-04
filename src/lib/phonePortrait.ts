type NavigatorWithMobileHint = Navigator & {
  userAgentData?: { mobile?: boolean };
};

type LockableScreen = Screen & {
  orientation?: ScreenOrientation & {
    lock?: (orientation: "portrait-primary") => Promise<void>;
  };
};

type ScreenSize = Pick<Screen, "width" | "height">;

export function isTruePhone(navigatorLike: NavigatorWithMobileHint): boolean {
  if (navigatorLike.userAgentData?.mobile === true) return true;

  const userAgent = navigatorLike.userAgent;
  if (/iPhone|iPod/i.test(userAgent)) return true;
  return /Android/i.test(userAgent) && /Mobile/i.test(userAgent);
}

export function isPhoneOrTablet(navigatorLike: NavigatorWithMobileHint): boolean {
  if (isTruePhone(navigatorLike)) return true;

  const userAgent = navigatorLike.userAgent;
  if (/iPad|Android/i.test(userAgent)) return true;

  // Modern iPadOS identifies Safari as Macintosh but retains multi-touch.
  return /Macintosh/i.test(userAgent) && navigatorLike.maxTouchPoints > 1;
}

export function isPortraitCompositionDevice(
  navigatorLike: NavigatorWithMobileHint,
  screenLike: ScreenSize,
): boolean {
  if (isPhoneOrTablet(navigatorLike)) return true;

  // Some privacy browsers and iPadOS desktop-mode tabs omit the familiar UA
  // tokens. Bound the fallback to a touch device whose shorter physical CSS
  // screen edge is tablet-sized. Recognizable desktop operating systems fail
  // closed before this deliberately narrow unknown-identity fallback.
  if (/Windows NT|CrOS|X11|Linux (?:x86_64|i686)|Ubuntu|Fedora/i.test(navigatorLike.userAgent)) {
    return false;
  }

  return navigatorLike.maxTouchPoints > 0 && Math.min(screenLike.width, screenLike.height) <= 1024;
}

export async function requestPhonePortraitLock(
  navigatorLike: NavigatorWithMobileHint,
  screenLike: LockableScreen,
): Promise<boolean> {
  if (!isPortraitCompositionDevice(navigatorLike, screenLike)) return false;

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
