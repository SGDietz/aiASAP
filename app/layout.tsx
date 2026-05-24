import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[radial-gradient(circle_at_center,#251407_0%,#130a04_58%,#050201_100%)] flex min-h-screen flex-col text-white justify-center items-center">
        {children}
      </body>
    </html>
  );
}
