import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@repo/ui/components/ui/sonner";

// 👇 Import your App CSS (which now includes the @source directive)
// 👇 Import UI CSS (Optional, but good for completeness)
import "@repo/ui/globals.css";

import { CSPostHogProvider } from "@/providers/posthog-provider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Workers Hive",
  description: "The OS for Modern Hospitality",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://workershive.com'),
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <div className="flex flex-col min-h-screen bg-background">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify([
                {
                  "@context": "https://schema.org",
                  "@type": "Organization",
                  "name": "Workers Hive",
                  "url": "https://workershive.com",
                  "logo": "https://workershive.com/logo.png"
                }
              ])
            }}
          />
          <CSPostHogProvider>
            {children}
          </CSPostHogProvider>
          {/* On phones the bottom tab bar sits at the bottom, so toasts (and their Undo) ride above it. */}
          <Toaster mobileOffset={{ bottom: "5.5rem" }} />
        </div>
      </body>
    </html>
  );
}