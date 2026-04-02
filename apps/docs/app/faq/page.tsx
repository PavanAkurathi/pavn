import { PageFrame, SectionBlock } from "../../components/docs-primitives";
import { faqs } from "../../lib/docs-content";

export default function FAQPage() {
  return (
    <PageFrame
      eyebrow="FAQ"
      title="Common questions"
      description="A short public FAQ for the business and worker access model we are actually shipping."
    >
      <SectionBlock
        title="Answers that matter before beta"
        description="These are the questions we want people to understand early so the product model feels clear instead of surprising."
      >
        <div className="grid gap-4">
          {faqs.map((faq) => (
            <article
              key={faq.question}
              className="rounded-[1.5rem] border border-border/70 bg-card p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold tracking-tight">
                {faq.question}
              </h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                {faq.answer}
              </p>
            </article>
          ))}
        </div>
      </SectionBlock>
    </PageFrame>
  );
}
