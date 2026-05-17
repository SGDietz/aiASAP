import "./globals.css";
import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://ai-asap.vercel.app";
const siteDescription =
  "TurboCharge Your Life by Talking to Your Computer. Build a Better Life, Create Content on AutoPilot, Build a Business. The All-In-One App (beta).";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "aiASAP - TurboCharge Your Life",
  applicationName: "aiASAP",
  description: siteDescription,
  icons: {
    icon: [
      {
        url: "/social-artwork/v12/aiasap-6-profile-master-1024.png",
        sizes: "1024x1024",
        type: "image/png",
      },
      {
        url: "/social-artwork/v12/youtube-watermark-150.png",
        sizes: "150x150",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/social-artwork/v12/aiasap-6-profile-master-1024.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    title: "aiASAP - TurboCharge Your Life",
    description: siteDescription,
    url: siteUrl,
    siteName: "aiASAP",
    images: [
      {
        url: "/social-artwork/v12/youtube-thumbnail-1280x720.png",
        width: 1280,
        height: 720,
        alt: siteDescription,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "aiASAP - TurboCharge Your Life",
    description: siteDescription,
    images: ["/social-artwork/v12/youtube-thumbnail-1280x720.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.liveavatar.com" />
        <link rel="dns-prefetch" href="https://api.liveavatar.com" />
      </head>
      <body className="bg-zinc-900 flex min-h-screen flex-col text-white justify-center items-center">
        {children}
      </body>
    </html>
  );
}
