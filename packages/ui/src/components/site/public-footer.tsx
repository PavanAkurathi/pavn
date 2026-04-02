import Link from "next/link";
import { Command } from "lucide-react";
import { Button } from "../ui/button";

type PublicFooterProps = {
  marketingBaseHref?: string;
  docsBaseHref?: string;
  resourceLinks?: Array<{
    href: string;
    text: string;
  }>;
};

function withBase(baseHref: string | undefined, path: string) {
  if (!baseHref) {
    return path;
  }

  return new URL(path, baseHref.replace(/\/+$/, "") + "/").toString();
}

export function PublicFooter({
  marketingBaseHref,
  docsBaseHref,
  resourceLinks,
}: PublicFooterProps) {
  const currentYear = new Date().getFullYear();
  const resolvedResourceLinks =
    resourceLinks ??
    [
      { href: withBase(docsBaseHref, "/"), text: "Docs Home" },
      {
        href: withBase(docsBaseHref, "/how-it-works"),
        text: "How It Works",
      },
      { href: withBase(docsBaseHref, "/faq"), text: "FAQ" },
      {
        href: withBase(marketingBaseHref, "/tools/roi-calculator"),
        text: "ROI Calculator",
      },
      {
        href: withBase(marketingBaseHref, "/status"),
        text: "System Status",
      },
    ];

  return (
    <footer className="border-t border-slate-900 bg-black font-sans text-slate-400">
      <div className="border-b border-slate-900">
        <div className="container mx-auto px-6 py-12 md:py-16">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="max-w-xl">
              <h3 className="mb-2 text-2xl font-bold text-white">
                Ready to simplify your scheduling?
              </h3>
              <p className="text-slate-400">
                Flat-rate pricing, unlimited staff, and a cleaner workflow for
                shift operations.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
              <Link href={withBase(marketingBaseHref, "/register")}>
                <Button className="h-auto bg-red-600 px-6 py-3 font-bold text-white hover:bg-red-700">
                  Start Free Trial
                </Button>
              </Link>
              <Link href={withBase(marketingBaseHref, "/demo")}>
                <Button
                  variant="outline"
                  className="h-auto border-slate-700 px-6 py-3 font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  Book a Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16 md:py-24">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-5 lg:gap-16">
          <div className="col-span-2 lg:col-span-2">
            <Link
              href={withBase(marketingBaseHref, "/")}
              className="mb-6 flex items-center gap-2 text-xl font-bold tracking-tight text-white"
            >
              <div className="rounded-md bg-white p-1 text-black">
                <Command className="h-5 w-5" />
              </div>
              Workers Hive
            </Link>
            <p className="mb-8 max-w-sm text-sm leading-relaxed text-slate-500">
              The operating system for modern shift-based teams. Build
              schedules, publish shifts, run attendance, and approve final
              timesheets without juggling disconnected tools.
            </p>
          </div>

          <div>
            <h4 className="mb-6 font-bold text-white">Platform</h4>
            <ul className="space-y-4 text-sm">
              <FooterLink
                href={withBase(marketingBaseHref, "/pricing")}
                text="Pricing"
              />
              <FooterLink
                href={withBase(marketingBaseHref, "/features")}
                text="Features"
              />
              <FooterLink
                href={withBase(marketingBaseHref, "/locations")}
                text="Locations"
              />
              <FooterLink
                href={withBase(marketingBaseHref, "/download")}
                text="Mobile App"
              />
              <FooterLink
                href={withBase(marketingBaseHref, "/demo")}
                text="Request Demo"
              />
            </ul>
          </div>

          <div>
            <h4 className="mb-6 font-bold text-white">Resources</h4>
            <ul className="space-y-4 text-sm">
              {resolvedResourceLinks.map((link) => (
                <FooterLink key={`${link.text}-${link.href}`} href={link.href} text={link.text} />
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-6 font-bold text-white">Company</h4>
            <ul className="space-y-4 text-sm">
              <FooterLink
                href={withBase(marketingBaseHref, "/about")}
                text="About Us"
              />
              <FooterLink
                href={withBase(marketingBaseHref, "/contact")}
                text="Contact"
              />
              <FooterLink
                href={withBase(marketingBaseHref, "/auth/sign-in")}
                text="Manager Login"
                highlight
              />
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-900 bg-slate-950/50">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 text-xs text-slate-500 md:flex-row">
            <div className="flex flex-col gap-4 text-center md:flex-row md:gap-8 md:text-left">
              <p>© {currentYear} Workers Hive Inc.</p>
              <Link
                href={withBase(marketingBaseHref, "/privacy")}
                className="transition-colors hover:text-white"
              >
                Privacy Policy
              </Link>
              <Link
                href={withBase(marketingBaseHref, "/terms")}
                className="transition-colors hover:text-white"
              >
                Terms of Service
              </Link>
              <Link
                href={withBase(marketingBaseHref, "/security")}
                className="transition-colors hover:text-white"
              >
                Security
              </Link>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span className="font-medium text-slate-300">
                  All Systems Operational
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  text,
  badge,
  highlight,
}: {
  href: string;
  text: string;
  badge?: string;
  highlight?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`flex items-center gap-2 transition-colors ${
          highlight
            ? "font-medium text-white hover:text-red-500"
            : "hover:text-white"
        }`}
      >
        {text}
        {badge ? (
          <span className="rounded border border-red-600/20 bg-red-600/10 px-1.5 py-0.5 text-[10px] font-bold text-red-500">
            {badge}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
