import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@repo/ui/components/ui/sonner";
import "@repo/ui/globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="flex flex-col min-h-screen bg-white">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify([
                {
                  "@context": "https://schema.org",
                  "@type": "Organization",
                  "name": "Workers Hive",
                  "url": "https://workershive.com",
                  "logo": "https://workershive.com/logo.png",
                  "sameAs": [
                    "https://twitter.com/workershive",
                    "https://linkedin.com/company/workershive"
                  ],
                  "contactPoint": {
                    "@type": "ContactPoint",
                    "telephone": "+1-555-000-0000",
                    "contactType": "customer service"
                  }
                }
              ])
            }}
          />
          {children}
          <Toaster />
        </div>
      </body>
    </html>
  );
}
