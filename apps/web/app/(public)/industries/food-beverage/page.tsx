import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";

const roleTiles = [
  "Bartenders",
  "Servers",
  "Line cooks",
  "Prep cooks",
  "Counter staff",
  "Dishwashers",
  "Hosts",
  "Shift leads",
] as const;

const workflowPoints = [
  {
    title: "Separate business access from worker access",
    body:
      "Managers and supervisors get workspace access through team invites, while service staff access the mobile experience through workforce setup and phone verification.",
  },
  {
    title: "Publish shifts when service is ready",
    body:
      "Build the schedule, assign the team, and publish only when the lineup is final so workers see one clear source of truth.",
  },
  {
    title: "Run attendance without back-and-forth",
    body:
      "Workers clock in and out on mobile, and correction requests can be reviewed before the final shift is approved.",
  },
] as const;

export const metadata: Metadata = {
  title: "Food & Beverage Scheduling Software | Workers Hive",
  description:
    "Workers Hive helps restaurants, bars, and dining facilities manage worker access, publish shifts, and review attendance from one operating system.",
  alternates: {
    canonical: "/industries/food-beverage",
  },
};

export default function FoodBeverageIndustryPage() {
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
                <li className="text-slate-900">Food &amp; beverage</li>
              </ol>
            </nav>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-tight text-slate-900 md:text-6xl">
                Run food service teams
                <span className="mt-2 block font-serif text-[0.88em] font-medium italic text-red-500">
                  without shift chaos
                </span>
              </h1>

              <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                Workers Hive helps restaurants, bars, caterers, and dining
                facilities set up workforce access, publish live shifts, and
                review attendance from one operating loop.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-14 rounded-xl bg-red-600 px-7 text-base font-bold hover:bg-red-700"
              >
                <Link href="/register">Start free trial</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 rounded-xl px-7 text-base font-bold">
                <Link href="/demo">Get demo</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_20%_20%,rgba(217,43,58,0.16),transparent_32%),radial-gradient(circle_at_80%_30%,rgba(24,37,64,0.12),transparent_30%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(24,37,64,0.18)]">
              <Image
                src="https://images.pexels.com/photos/19674061/pexels-photo-19674061.jpeg?cs=srgb&dl=pexels-alexandru-cojanu-828538450-19674061.jpg&fm=jpg"
                alt="Bartender preparing drinks during service"
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
            <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
              From bartenders to bussers,
              <span className="mt-2 block font-serif text-[0.92em] font-medium italic text-white/85">
                we have the workflow covered
              </span>
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-200">
              Build one clear system for managers, supervisors, and frontline
              workers without turning your operation into a marketplace signup
              flow.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {roleTiles.map((role) => (
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
              Built for service teams that need real shift accountability
            </h2>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {workflowPoints.map((point, index) => (
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
              Ready to run restaurant shifts with less friction?
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Start with a business workspace, add your team, and publish the
              schedule when service is ready.
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
            <Button asChild size="lg" variant="outline" className="h-14 rounded-xl px-7 text-base font-bold">
              <Link href="/how-it-works">Back to how it works</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
