import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@repo/ui/components/ui/button";

export function HowItWorksPageFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12 md:py-16">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-[0_20px_80px_rgba(24,37,64,0.08)] sm:p-10">
        <div className="max-w-3xl space-y-6">
          <span className="inline-flex rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-red-600">
            {eyebrow}
          </span>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              {description}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-red-600 hover:bg-red-700">
              <Link href="/register">Start free trial</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/how-it-works">Back to how it works</Link>
            </Button>
          </div>
        </div>
      </section>

      {children}
    </main>
  );
}

export function HowItWorksSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function WorkflowCard({
  step,
  title,
  description,
  detail,
}: {
  step: string;
  title: string;
  description: string;
  detail?: string;
}) {
  return (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-900">
        {step}
      </div>
      <div className="space-y-3">
        <h3 className="text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h3>
        <p className="leading-7 text-slate-600">{description}</p>
        {detail ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            {detail}
          </p>
        ) : null}
      </div>
    </article>
  );
}
