import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-900 flex min-h-screen flex-col text-white justify-center items-center">
        {children}
      </body>
    </html>
  );
}
