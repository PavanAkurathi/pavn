import { CircleCheck, CirclePlus, Minus, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { coverageText, type DayCoverage, type DayStatus } from "@/lib/scheduler/day-model";

const LOOK: Record<DayStatus, { icon: LucideIcon; tone: string }> = {
    covered: { icon: CircleCheck, tone: "bg-ok-soft text-ok" },
    needs: { icon: CirclePlus, tone: "bg-warn-soft text-warn ring-1 ring-inset ring-warn-line/50" },
    problem: { icon: TriangleAlert, tone: "bg-primary-soft text-destructive ring-1 ring-inset ring-destructive/40" },
    empty: { icon: Minus, tone: "bg-muted text-foreground/70" },
};

/** What a narrow tile shows instead of words: a number, never colour alone. */
function compactText(c: DayCoverage): string {
    if (c.status === "problem") return String(c.problems);
    if (c.status === "needs") return String(c.open);
    return "";
}

/**
 * How covered a day is, said three ways: an icon, a colour, and words (numbers
 * where the tile is narrow). Colour is never the only signal.
 */
export function CoverageBadge({ coverage, className }: { coverage: DayCoverage; className?: string }) {
    const { icon: Icon, tone } = LOOK[coverage.status];
    const words = coverageText(coverage);
    return (
        <span
            className={cn(
                "inline-flex h-6 max-w-full items-center justify-center gap-1 rounded-full px-1.5 text-xs font-semibold leading-none sm:px-2",
                tone,
                className,
            )}
        >
            <Icon aria-hidden className="size-3.5 shrink-0" />
            <span className="sr-only">{words.long}</span>
            <span aria-hidden className="truncate lg:hidden">
                {compactText(coverage)}
            </span>
            <span aria-hidden className="hidden truncate lg:inline">
                {words.short}
            </span>
        </span>
    );
}
