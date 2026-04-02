import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@repo/ui/components/ui/button";

export function PageFrame({
  eyebrow,
  title,
  description,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-10 sm:px-6 sm:py-14">
      <section className="rounded-[2rem] border border-border/60 bg-background/85 p-8 shadow-[0_20px_80px_rgba(24,37,64,0.08)] sm:p-10">
        <div className="max-w-3xl space-y-6">
          <span className="inline-flex rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            {eyebrow}
          </span>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              {description}
            </p>
          </div>
          {actions}
        </div>
      </section>

      {children}
    </main>
  );
}

export function SectionBlock({
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
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function StepCard({
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
    <article className="rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-sm">
      <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-sm font-semibold text-secondary-foreground">
        {step}
      </div>
      <div className="space-y-3">
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
        <p className="leading-7 text-muted-foreground">{description}</p>
        {detail ? (
          <p className="rounded-2xl bg-muted px-4 py-3 text-sm leading-6 text-foreground/80">
            {detail}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function HighlightCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-[1.5rem] border border-border/70 bg-background/90 p-5 shadow-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
    </article>
  );
}

export function CTACluster() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild size="lg">
        <Link href="/how-it-works">See the full flow</Link>
      </Button>
      <Button asChild variant="outline" size="lg">
        <Link href="/faq">Read common questions</Link>
      </Button>
    </div>
  );
}
