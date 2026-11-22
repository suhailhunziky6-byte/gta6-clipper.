import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClipVI — GTA 6 Clip & Reel Studio",
  description: "Paste a YouTube link, trim the perfect GTA 6 moment, reframe to 9:16, add captions and filters, and make reels.",
};

export const viewport: Viewport = {
  themeColor: "#07060d",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
