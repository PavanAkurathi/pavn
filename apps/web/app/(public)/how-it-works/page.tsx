import type { Metadata } from "next";
import { HowItWorksLanding } from "@/components/marketing/how-it-works-landing";

export const metadata: Metadata = {
  title: "How It Works | Workers Hive",
  description:
    "See how Workers Hive helps businesses onboard teams, publish shifts, run mobile attendance, and approve final timesheets.",
  alternates: {
    canonical: "/how-it-works",
  },
};

export default function HowItWorksPage() {
  return <HowItWorksLanding />;
}
