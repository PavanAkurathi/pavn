import type { SchedulerPerson } from "@repo/contracts/scheduler";
import { cn } from "@repo/ui/lib/utils";
import { roleColor } from "@/lib/scheduler/role-color";

function initialsOf(name: string) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return ((words[0]?.[0] ?? "?") + (words.length > 1 ? words[words.length - 1]![0]! : "")).toUpperCase();
}

/** Initials on the person's role colour. Decoration only: the name is always written next to it. */
export function PersonAvatar({
    person,
    role,
    className,
}: {
    person: Pick<SchedulerPerson, "name" | "initials" | "primaryRole"> | null;
    role?: string | null;
    className?: string;
}) {
    const name = person?.name ?? "";
    return (
        <span
            aria-hidden
            className={cn("grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold", className)}
            style={{ background: roleColor(role ?? person?.primaryRole), color: "var(--role-foreground, #0d0d0d)" }}
        >
            {person ? person.initials || initialsOf(name) : "?"}
        </span>
    );
}
