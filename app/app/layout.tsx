import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOL-DEX | Perpetual Trading Terminal",
  description: "Solana perpetual futures trading terminal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("sol-dex-theme");if(t==="light"||t==="dark")document.documentElement.className=t}catch(e){}})();`,
          }}
        />
      </head>
      <body className="h-screen overflow-hidden bg-bg-base text-text-main font-sans">
        {children}
      </body>
    </html>
  );
}
