import Image from "next/image";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { CoverageMediaGrid } from "./coverage-media-grid";

const steps = [
  {
    number: "1",
    title: "Set up your business",
    body: "Create the workspace, finish onboarding, and configure the first operating location before shift planning starts.",
  },
  {
    number: "2",
    title: "Add workers and publish shifts",
    body: "Bring in managers through team invites, add workers through workforce access, then publish the schedule when it is ready.",
  },
  {
    number: "3",
    title: "Run the shift and approve the result",
    body: "Workers clock in and out from mobile, managers review correction requests, and the business approves the final timesheet.",
  },
];

const faqs = [
  {
    question: "Can workers sign up without an invitation from the business?",
    answer:
      "No. Workers Hive uses workforce access as the gate. A business must first add the worker with a valid phone number before that worker can log into the mobile app.",
  },
  {
    question: "Are business team invites and worker access the same thing?",
    answer:
      "No. Admins and managers are invited into the business workspace. Workers receive workforce access for the mobile app and shift attendance flow.",
  },
  {
    question: "What happens after a shift is published?",
    answer:
      "Published shifts become visible to eligible workers. From there, workers can view shift details, clock in and out, and request corrections if something needs review.",
  },
  {
    question: "Who handles onboarding when the business is not fully set up yet?",
    answer:
      "Admins own incomplete business onboarding. Managers can help operate the business later without being forced through admin-only setup tasks.",
  },
  {
    question: "What makes the product different from a staffing marketplace?",
    answer:
      "Workers Hive is for businesses managing their own workforce. It is focused on scheduling, attendance, approvals, and mobile worker access, not matching businesses with marketplace labor.",
  },
];

export function HowItWorksLanding({
  marketingBaseHref,
}: {
  marketingBaseHref?: string;
}) {
  const registerHref = marketingBaseHref
    ? new URL("/register", marketingBaseHref + "/").toString()
    : "/register";

  return (
    <main className="flex-1">
      <section className="overflow-hidden border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20 lg:pb-24 lg:pt-32">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              Public product docs
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
                Run reliable shift teams
                <span className="mt-2 block font-serif text-[0.88em] font-medium italic text-red-500">
                  without the spreadsheet chaos
                </span>
              </h1>

              <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                Workers Hive helps businesses set up locations, add workers,
                publish shifts, run attendance, and approve final timesheets.
                Workers join through their business, not through an open
                marketplace.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-14 rounded-xl bg-red-600 px-7 text-base font-bold hover:bg-red-700"
              >
                <Link href="/how-it-works/businesses">I run the business</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 rounded-xl px-7 text-base font-bold">
                <Link href="/how-it-works/workers">I’m a worker</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoChip
                accent="WH"
                label="Business onboarding"
                detail="Admins set up the workspace"
              />
              <InfoChip
                accent="24"
                label="Published shifts"
                detail="Schedules become live for workers"
              />
              <InfoChip
                accent="OK"
                label="Attendance approvals"
                detail="Corrections stay reviewable"
              />
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_20%_20%,rgba(217,43,58,0.16),transparent_32%),radial-gradient(circle_at_80%_30%,rgba(24,37,64,0.12),transparent_30%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_30px_120px_rgba(24,37,64,0.18)]">
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                <span className="font-semibold text-slate-900">
                  Publish the shift when it is ready
                </span>
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-red-600">
                  Live ops
                </span>
              </div>
              <Image
                src="/images/mockups/schedule-composite.png"
                alt="Workers Hive schedule publishing flow"
                width={1024}
                height={1024}
                className="h-auto w-full rounded-[1.5rem]"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(120deg,#222733_0%,#2c3654_100%)] py-24 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 max-w-2xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-white/65">
              How it works
            </p>
            <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
              One clear operating loop from setup to approval
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {steps.map((step) => (
              <article
                key={step.number}
                className="rounded-[2rem] border border-white/20 bg-white/6 p-8 shadow-sm backdrop-blur-sm"
              >
                <div className="text-7xl font-semibold leading-none text-white">
                  {step.number}
                </div>
                <h3 className="mt-8 text-3xl font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-6 text-lg leading-8 text-slate-200">
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-red-600">
              Built for real operations
            </p>
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              From warehousing and retail to dining facilities,
              <span className="mt-2 block font-serif text-[0.92em] font-medium italic text-red-500">
                we have the flow covered
              </span>
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              The product model is not marketplace staffing. It is operational
              software for businesses that already own the workforce and need a
              better way to schedule, run attendance, and close the loop.
            </p>
          </div>

          <CoverageMediaGrid />
        </div>
      </section>

      <section className="bg-white pb-24 pt-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-red-600">
              Common questions
            </p>
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              Everything you want to know before beta rollout
            </h2>
          </div>

          <div className="mt-10 rounded-[2rem] border border-slate-200 bg-white px-6 py-3 shadow-sm sm:px-8">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={`faq-${index}`}
                  className="border-slate-200"
                >
                  <AccordionTrigger className="py-8 text-left text-2xl font-medium text-slate-900 hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-8 text-lg leading-8 text-slate-600">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="mt-12 flex flex-col items-start gap-4 rounded-[2rem] bg-slate-50 px-8 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
                Ready to see the workflow in action?
              </h3>
              <p className="mt-2 text-base text-slate-600">
                Start with the business flow, then review the worker side.
              </p>
            </div>
            <Button asChild size="lg" className="h-14 rounded-xl bg-red-600 px-7 text-base font-bold hover:bg-red-700">
              <Link href={registerHref}>Start free trial</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoChip({
  accent,
  label,
  detail,
}: {
  accent: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-bold text-slate-900 shadow-sm">
          {accent}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="text-sm text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}
