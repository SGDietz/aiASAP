import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[radial-gradient(circle_at_center,#3a2108_0%,#1f1208_58%,#0a0604_100%)] flex min-h-screen flex-col text-white justify-center items-center">
        {children}
      </body>
    </html>
  );
}
