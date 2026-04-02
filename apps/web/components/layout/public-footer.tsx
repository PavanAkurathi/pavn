import { PublicFooter as SharedPublicFooter } from "@repo/ui/components/site/public-footer";

export function PublicFooter() {
  return (
    <SharedPublicFooter
      resourceLinks={[
        { href: "/resources", text: "Blog & Guides" },
        { href: "/help", text: "Help Center" },
        { href: "/tools/roi-calculator", text: "ROI Calculator" },
        { href: "/compliance", text: "Fair Workweek" },
        { href: "/status", text: "System Status" },
      ]}
    />
  );
}
