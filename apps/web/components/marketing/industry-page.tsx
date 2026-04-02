import Image from "next/image";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import type { IndustryPageContent } from "@/lib/how-it-works-content";

export function IndustryPage({
  industry,
}: {
  industry: IndustryPageContent;
}) {
  return (
    <div className="bg-white">
      <section className="overflow-hidden border-b border-slate-200">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20 lg:pb-24 lg:pt-32">
          <div className="space-y-7">
            <nav
              aria-label="Breadcrumb"
              className="text-sm font-medium text-slate-500"
            >
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <Link href="/how-it-works" className="hover:text-slate-900">
                    How it works
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    href="/how-it-works/businesses"
                    className="hover:text-slate-900"
                  >
                    Industries
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-slate-900">{industry.title}</li>
              </ol>
            </nav>

            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              {industry.heroBadge}
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-tight text-slate-900 md:text-6xl">
                {industry.heroTitle}
                <span className="mt-2 block font-serif text-[0.88em] font-medium italic text-red-500">
                  {industry.heroAccent}
                </span>
              </h1>

              <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                {industry.heroDescription}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {industry.heroChips.map((chip) => (
                <article
                  key={chip.label}
                  className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 shadow-sm"
                >
                  <h2 className="text-base font-semibold tracking-tight text-slate-900">
                    {chip.label}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {chip.detail}
                  </p>
                </article>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-14 rounded-xl bg-red-600 px-7 text-base font-bold hover:bg-red-700"
              >
                <Link href="/register">Start free trial</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 rounded-xl px-7 text-base font-bold"
              >
                <Link href="/demo">Get demo</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_20%_20%,rgba(217,43,58,0.16),transparent_32%),radial-gradient(circle_at_80%_30%,rgba(24,37,64,0.12),transparent_30%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(24,37,64,0.18)]">
              <Image
                src={industry.posterSrc}
                alt={industry.heroMediaAlt}
                width={1100}
                height={900}
                className="h-auto w-full object-cover"
                unoptimized
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(120deg,#222733_0%,#2c3654_100%)] py-24 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-white/65">
              Teams in context
            </p>
            <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
              {industry.rolesTitle}
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-200">
              {industry.rolesIntro}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {industry.roles.map((role) => (
              <article
                key={role}
                className="rounded-[1.5rem] border border-white/15 bg-white/6 px-5 py-6 shadow-sm backdrop-blur-sm"
              >
                <p className="text-lg font-semibold text-white">{role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-red-600">
              Why it works
            </p>
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              {industry.workflowTitle}
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              {industry.workflowDescription}
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {industry.workflowPoints.map((point, index) => (
              <article
                key={point.title}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-sm"
              >
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-sm font-semibold text-red-600">
                  0{index + 1}
                </div>
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {point.title}
                </h3>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  {point.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              {industry.ctaTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              {industry.ctaDescription}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button
              asChild
              size="lg"
              className="h-14 rounded-xl bg-red-600 px-7 text-base font-bold hover:bg-red-700"
            >
              <Link href="/register">Start free trial</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-xl px-7 text-base font-bold"
            >
              <Link href="/how-it-works">Back to how it works</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
