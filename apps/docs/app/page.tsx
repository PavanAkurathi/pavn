import { HowItWorksLanding } from "../components/how-it-works-landing";
import { getMarketingBaseHref } from "../lib/site-urls";

export default function Home() {
  return <HowItWorksLanding marketingBaseHref={getMarketingBaseHref()} />;
}
