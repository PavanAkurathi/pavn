import type { ElementType, ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

type MarketingHeadingProps = {
  as?: "h1" | "h2" | "h3";
  title: string;
  accent?: string;
  description?: ReactNode;
  eyebrow?: string;
  align?: "left" | "center";
  size?: "hero" | "section" | "subsection";
  className?: string;
  titleClassName?: string;
  accentClassName?: string;
  descriptionClassName?: string;
  eyebrowClassName?: string;
};

const sizeClasses = {
  hero: "text-5xl lg:text-7xl leading-[1.02]",
  section: "text-4xl md:text-6xl leading-[1.04]",
  subsection: "text-3xl md:text-5xl leading-[1.06]",
} as const;

export function MarketingHeading({
  as = "h2",
  title,
  accent,
  description,
  eyebrow,
  align = "left",
  size = "section",
  className,
  titleClassName,
  accentClassName,
  descriptionClassName,
  eyebrowClassName,
}: MarketingHeadingProps) {
  const Tag = as as ElementType;

  return (
    <div
      className={cn(
        "space-y-5",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            "text-sm font-semibold uppercase tracking-[0.22em] text-red-600",
            eyebrowClassName,
          )}
        >
          {eyebrow}
        </p>
      ) : null}

      <Tag
        className={cn(
          "font-extrabold tracking-tight text-slate-900",
          sizeClasses[size],
          titleClassName,
        )}
      >
        <span className="block">{title}</span>
        {accent ? (
          <span
            className={cn(
              "mt-2 block font-serif text-[0.88em] font-medium italic text-red-500",
              accentClassName,
            )}
          >
            {accent}
          </span>
        ) : null}
      </Tag>

      {description ? (
        <p
          className={cn(
            "text-lg leading-8 text-slate-600 md:text-xl",
            align === "center" && "mx-auto",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
