import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME, DEPARTMENT_NAME } from "@/lib/branding";
import { THEME, hexToRgbChannels } from "@/lib/theme";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description:
    `Submit Payment Advice, Cash Payment Voucher, and Advance Payment requests to the ${DEPARTMENT_NAME}.`,
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: THEME.brand,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      style={
        {
          "--brand": THEME.brand,
          "--brand-rgb": hexToRgbChannels(THEME.brand),
          "--forest": THEME.forest,
          "--amber": THEME.amber,
        } as React.CSSProperties
      }
    >
      <body className="min-h-full flex flex-col bg-white text-[#171717]">
        {children}
      </body>
    </html>
  );
}
