import type { Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { TouchActive } from "@/components/checkout/TouchActive";

const display = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  variable: "--font-display",
  display: "swap",
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5eee1" },
    { media: "(prefers-color-scheme: dark)", color: "#111a18" },
  ],
};

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`shop ${display.variable} ${body.variable}`}>
      <TouchActive />
      {children}
    </div>
  );
}
