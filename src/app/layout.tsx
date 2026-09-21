import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "AI Candidate Sourcing & Recruitment Research Platform",
  description: "AI-assisted candidate sourcing and recruitment research",
};

import { ToastProvider } from "@/components/ui/toast";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
