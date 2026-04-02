import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IndustryPage } from "@/components/marketing/industry-page";
import { getIndustryPage, industryPages } from "@/lib/how-it-works-content";

type IndustryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return industryPages.map((industry) => ({
    slug: industry.slug,
  }));
}

export async function generateMetadata({
  params,
}: IndustryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const industry = getIndustryPage(slug);

  if (!industry) {
    return {};
  }

  return {
    title: industry.pageTitle,
    description: industry.metaDescription,
    alternates: {
      canonical: `/industries/${industry.slug}`,
    },
  };
}

export default async function IndustryRoutePage({
  params,
}: IndustryPageProps) {
  const { slug } = await params;
  const industry = getIndustryPage(slug);

  if (!industry) {
    notFound();
  }

  return <IndustryPage industry={industry} />;
}
