import { cn } from "@repo/ui/lib/utils";

/** The business's logo, or its first letter on brand navy when it has none. */
export function OrgMark({
    name,
    logo,
    className,
}: {
    name?: string | null;
    logo?: string | null;
    className?: string;
}) {
    const initial = name?.trim().charAt(0).toUpperCase() || "W";
    return (
        <span
            aria-hidden
            className={cn(
                "grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-base font-semibold text-secondary-foreground shadow-sm",
                className,
            )}
        >
            {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- org logos are user-supplied URLs of unknown size
                <img src={logo} alt="" className="size-full object-cover" />
            ) : (
                initial
            )}
        </span>
    );
}
