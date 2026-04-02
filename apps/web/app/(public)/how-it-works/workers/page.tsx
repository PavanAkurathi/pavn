import type { Metadata } from "next";
import {
  HowItWorksPageFrame,
  HowItWorksSection,
  WorkflowCard,
} from "@/components/marketing/how-it-works-page-frame";
import { workerFlowSteps } from "@/lib/how-it-works-content";

export const metadata: Metadata = {
  title: "How It Works for Workers | Workers Hive",
  description:
    "See how workers join through business invites, verify by phone, access shifts, and submit attendance corrections in Workers Hive.",
  alternates: {
    canonical: "/how-it-works/workers",
  },
};

export default function WorkersHowItWorksPage() {
  return (
    <HowItWorksPageFrame
      eyebrow="Workers"
      title="How Workers Hive works for workers"
      description="Workers Hive gives workers a mobile-first path into live shifts, attendance, and corrections without turning the experience into a marketplace signup flow."
    >
      <HowItWorksSection
        title="The worker mobile flow"
        description="Workers belong to a business through workforce access. That rule stays visible because it is fundamental to the product."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {workerFlowSteps.map((step) => (
            <WorkflowCard key={step.step} {...step} />
          ))}
        </div>
      </HowItWorksSection>

      <HowItWorksSection
        title="What workers should know"
        description="The worker side is intentionally simple, but a few rules deserve direct explanation."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              No open self-signup
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A worker cannot access the app until a business has first added
              them with workforce access.
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Phone OTP is the sign-in
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Workers use phone verification to sign in. The access gate is the
              business-created workforce record, not a public registration form.
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Corrections are reviewable
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              If attendance timing needs to be corrected, workers can request a
              review instead of being stuck with a bad record.
            </p>
          </article>
        </div>
      </HowItWorksSection>
    </HowItWorksPageFrame>
  );
}
