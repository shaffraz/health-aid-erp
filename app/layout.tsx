import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { cryptoUuidPolyfill } from "@/lib/crypto-polyfill";
import "./globals.css";

export const metadata: Metadata = {
  title: "Health Aid Arugambay ERP",
  description: "Secure healthcare ERP for Health Aid Arugambay"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          id="crypto-randomuuid-polyfill"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: cryptoUuidPolyfill }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
