import "./globals.css";
import type { Viewport } from "next";
import { AuthProvider } from "../src/lib/auth/AuthProvider";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[radial-gradient(circle_at_center,#3a2108_0%,#1f1208_58%,#0a0604_100%)] flex min-h-screen flex-col text-white justify-center items-center">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
