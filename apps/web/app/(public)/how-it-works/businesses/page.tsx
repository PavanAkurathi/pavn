import type { Metadata } from "next";
import {
  HowItWorksPageFrame,
  HowItWorksSection,
  WorkflowCard,
} from "@/components/marketing/how-it-works-page-frame";
import {
  businessFlowSteps,
  industryHighlights,
} from "@/lib/how-it-works-content";

export const metadata: Metadata = {
  title: "How It Works for Businesses | Workers Hive",
  description:
    "Understand how businesses use Workers Hive to set up teams, publish shifts, and review attendance from one operating system.",
  alternates: {
    canonical: "/how-it-works/businesses",
  },
};

export default function BusinessesHowItWorksPage() {
  return (
    <HowItWorksPageFrame
      eyebrow="Businesses"
      title="How Workers Hive works for businesses"
      description="Businesses use Workers Hive to set up the workspace, grant the right access, publish shifts, and review attendance from one operating system."
    >
      <HowItWorksSection
        title="The business operating flow"
        description="This is the public story we want prospects and beta users to understand before they enter the product."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {businessFlowSteps.map((step) => (
            <WorkflowCard key={step.step} {...step} />
          ))}
        </div>
      </HowItWorksSection>

      <HowItWorksSection
        title="What businesses should know"
        description="A few product rules matter because they shape setup and rollout."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Admins own setup
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Admins finish the initial business setup. Managers can help run
              the operation later without being forced through admin-only setup.
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Team access stays separate
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Admin and manager invites are business-side access. They are not
              the same as worker mobile access.
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Publication matters
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A shift is not truly live until it is published. That is the
              point when workers can see and act on it.
            </p>
          </article>
        </div>
      </HowItWorksSection>

      <HowItWorksSection
        title="Industry examples"
        description="These are the operating patterns behind the tiles on the main How It Works page. Each one points back to the same product model: set up the business, add workforce access, publish shifts, then review attendance and approvals."
      >
        <div className="grid gap-4">
          {industryHighlights.map((industry) => (
            <article
              key={industry.slug}
              id={industry.slug}
              className="scroll-mt-28 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {industry.title}
                  </h3>
                  <p className="max-w-3xl text-base leading-7 text-slate-600">
                    {industry.summary}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
                  Business flow
                </span>
              </div>
              <p className="mt-5 rounded-[1.25rem] bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-700">
                {industry.detail}
              </p>
            </article>
          ))}
        </div>
      </HowItWorksSection>
    </HowItWorksPageFrame>
  );
}
