import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "../src/lib/auth/AuthProvider";
import { getEarlyStartBridgeSource } from "../src/lib/voice/earlyStartBridge";

// G 2026-06-14 (iPad smoke: "pinch wants to zoom the entire app"): lock the
// browser page-zoom so pinch only drives our in-app gesture (list resize), not
// the whole screen. (iOS Safari also ignores this — see the gesture* guard in
// LiveAvatarSession — so we do both.)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          SPEED (2026-09-04). Tap to 6 speaking measured 10.6s on G's ride, and
          6.5s of it is the provider session call. The browser cannot even start
          that call until it has done DNS, TLS and the TCP handshake to the
          provider - work it currently begins only AFTER the tap, on a phone, on
          mobile data.

          The SDK talks to api.liveavatar.com from the CLIENT (its own
          SessionAPIClient shows up in client stack traces), so warming that
          connection while the visitor is still reading the front door is free
          time we are otherwise throwing away.

          preconnect opens the socket; dns-prefetch is the cheap fallback for
          browsers that cap preconnects. Neither fetches anything, neither can
          mint, and both are dropped harmlessly if unused.
        */}
        <link rel="preconnect" href="https://api.liveavatar.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.liveavatar.com" />
        <style>{`
          [data-six-early-start-loader] {
            display: flex;
            visibility: hidden;
            opacity: 0;
            pointer-events: none;
            background: #1f1005;
          }
          html[data-aiasap-early-start-state="loading"] [data-six-initial-idle] > :not([data-six-stage-media="1"]) {
            visibility: hidden;
          }
          html[data-aiasap-early-start-state="loading"] [data-six-early-start-loader] {
            visibility: visible;
            opacity: 1;
          }
        `}</style>
      </head>
      <body className="bg-[radial-gradient(circle_at_center,#3a2108_0%,#1f1208_58%,#0a0604_100%)] flex min-h-screen flex-col text-white justify-center items-center">
        <script
          id="aiasap-early-start-bridge"
          dangerouslySetInnerHTML={{ __html: getEarlyStartBridgeSource() }}
        />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
