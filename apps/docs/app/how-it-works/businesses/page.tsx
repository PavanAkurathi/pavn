import { PageFrame, SectionBlock, StepCard } from "../../../components/docs-primitives";
import { businessSteps, industryHighlights } from "../../../lib/docs-content";

export default function BusinessDocsPage() {
  return (
    <PageFrame
      eyebrow="Businesses"
      title="How Workers Hive works for businesses"
      description="Businesses use Workers Hive to set up the workspace, grant the right access, publish shifts, and review attendance from one operating system."
    >
      <SectionBlock
        title="The business operating flow"
        description="This is the public story we want prospects and beta users to understand before they enter the product."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {businessSteps.map((step) => (
            <StepCard key={step.step} {...step} />
          ))}
        </div>
      </SectionBlock>

      <SectionBlock
        title="What businesses should know"
        description="A few product rules matter because they shape setup and rollout."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Admins own setup</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Admins finish the initial business setup. Managers can help run
              the operation later without being forced through admin-only setup.
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Team access stays separate</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Admin and manager invites are business-side access. They are not
              the same as worker mobile access.
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Publication matters</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              A shift is not truly live until it is published. That is the
              point when workers can see and act on it.
            </p>
          </article>
        </div>
      </SectionBlock>

      <SectionBlock
        title="Industry examples"
        description="These are the operating patterns behind the tiles on the main How It Works page. Each one points back to the same product model: set up the business, add workforce access, publish shifts, then review attendance and approvals."
      >
        <div className="grid gap-4">
          {industryHighlights.map((industry) => (
            <article
              key={industry.slug}
              id={industry.slug}
              className="scroll-mt-28 rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <h3 className="text-2xl font-semibold tracking-tight">
                    {industry.title}
                  </h3>
                  <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                    {industry.summary}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Business flow
                </span>
              </div>
              <p className="mt-5 rounded-[1.25rem] bg-muted px-5 py-4 text-sm leading-6 text-foreground/80">
                {industry.detail}
              </p>
            </article>
          ))}
        </div>
      </SectionBlock>
    </PageFrame>
  );
}
