import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Health Aid Arugambay ERP POS",
  description: "Secure healthcare ERP POS for Health Aid Arugambay"
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
      <body>
        <Script
          id="crypto-randomuuid-polyfill"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  function makeUuid() {
    var bytes = new Uint8Array(16);
    var cryptoObject = window.crypto || window.msCrypto;

    if (cryptoObject && typeof cryptoObject.getRandomValues === "function") {
      cryptoObject.getRandomValues(bytes);
    } else {
      for (var index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }

    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;

    var hex = [];
    for (var byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
      var value = bytes[byteIndex].toString(16);
      hex.push(value.length === 1 ? "0" + value : value);
    }

    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join("")
    ].join("-");
  }

  try {
    var cryptoObject = window.crypto;

    if (!cryptoObject) {
      cryptoObject = {};
      Object.defineProperty(window, "crypto", {
        value: cryptoObject,
        configurable: true
      });
    }

    if (typeof cryptoObject.randomUUID !== "function") {
      Object.defineProperty(cryptoObject, "randomUUID", {
        value: makeUuid,
        configurable: true
      });
    }
  } catch (error) {
    try {
      if (window.crypto && typeof window.crypto.randomUUID !== "function") {
        window.crypto.randomUUID = makeUuid;
      }
    } catch (fallbackError) {}
  }
})();
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}
