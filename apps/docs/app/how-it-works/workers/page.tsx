import { PageFrame, SectionBlock, StepCard } from "../../../components/docs-primitives";
import { workerSteps } from "../../../lib/docs-content";

export default function WorkerDocsPage() {
  return (
    <PageFrame
      eyebrow="Workers"
      title="How Workers Hive works for workers"
      description="Workers Hive gives workers a mobile-first path into live shifts, attendance, and corrections without turning the experience into a marketplace signup flow."
    >
      <SectionBlock
        title="The worker mobile flow"
        description="Workers belong to a business through workforce access. That rule stays visible in the docs because it is fundamental to the product."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {workerSteps.map((step) => (
            <StepCard key={step.step} {...step} />
          ))}
        </div>
      </SectionBlock>

      <SectionBlock
        title="What workers should know"
        description="The worker side is intentionally simple, but a few rules deserve direct explanation."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold">No open self-signup</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              A worker cannot access the app until a business has first added
              them with workforce access.
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Phone OTP is the sign-in</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Workers use phone verification to sign in. The access gate is the
              business-created workforce record, not a public registration form.
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Corrections are reviewable</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              If attendance timing needs to be corrected, workers can request a
              review instead of being stuck with a bad record.
            </p>
          </article>
        </div>
      </SectionBlock>
    </PageFrame>
  );
}
