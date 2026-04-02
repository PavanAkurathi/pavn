import type { Metadata } from "next";
import localFont from "next/font/local";
import "@repo/ui/globals.css";
import { PublicFooter } from "@repo/ui/components/site/public-footer";
import { SiteHeader } from "../components/site-header";
import { getMarketingBaseHref } from "../lib/site-urls";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Workers Hive Docs",
  description:
    "Public product documentation for Workers Hive covering how the platform works for businesses and workers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const marketingBaseHref = getMarketingBaseHref();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(217,43,58,0.10),_transparent_32%),linear-gradient(180deg,#fff9f4_0%,#ffffff_38%,#f7f7f4_100%)] text-foreground`}
      >
        <SiteHeader />
        {children}
        <PublicFooter
          marketingBaseHref={marketingBaseHref}
          docsBaseHref=""
        />
      </body>
    </html>
  );
}
