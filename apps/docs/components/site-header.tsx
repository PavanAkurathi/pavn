import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { NAV_ITEMS } from "../lib/docs-content";
import { getMarketingBaseHref } from "../lib/site-urls";

export function SiteHeader() {
  const marketingBaseHref = getMarketingBaseHref();
  const loginHref = marketingBaseHref
    ? new URL("/auth/sign-in", marketingBaseHref + "/").toString()
    : "/auth/sign-in";
  const registerHref = marketingBaseHref
    ? new URL("/register", marketingBaseHref + "/").toString()
    : "/register";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              WH
            </div>
            Workers Hive
            <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
              Docs
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href={loginHref}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Log in
          </Link>
          <Button asChild className="bg-red-600 font-semibold text-white hover:bg-red-700">
            <Link href={registerHref}>Start Free Trial</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
