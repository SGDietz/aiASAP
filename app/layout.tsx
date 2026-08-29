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
