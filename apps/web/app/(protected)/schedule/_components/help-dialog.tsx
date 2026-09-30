"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { cn } from "@repo/ui/lib/utils";
import styles from "./scheduler.module.css";

function Sample({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <span className={cn(styles.chip, "w-24 shrink-0", className)} style={{ ["--rc" as string]: "var(--role-server)" }}>
            {children}
        </span>
    );
}

/** What the Week table's markings mean. The Day view says all of this in words. */
const MARKINGS: { sample: React.ReactNode; text: string }[] = [
    { sample: <Sample><span className={styles.time}>4p–11p</span></Sample>, text: "Shared. Your team sees it in the app." },
    {
        sample: (
            <Sample className={styles.draft}>
                <span className={styles.time}>4p–11p</span>
            </Sample>
        ),
        text: "Stripes: not shared yet.",
    },
    {
        sample: (
            <Sample>
                <span className={styles.time}>4p–11p</span>
                <span className={styles.edited} />
            </Sample>
        ),
        text: "Orange dot: shared, with changes not shared yet.",
    },
    {
        sample: (
            <Sample>
                <span className={styles.time}>4p–11p</span>
                <span className={styles.flag}>!</span>
            </Sample>
        ),
        text: "Red !: a real problem, like a double booking or approved time off.",
    },
    {
        sample: (
            <Sample className={styles.open}>
                <span className={styles.time}>4p–11p</span>
                <span className={cn(styles.fill, "text-warn")}>2</span>
            </Sample>
        ),
        text: "Dashed: spots nobody has taken yet.",
    },
    { sample: <span className={cn(styles.off, "w-24 shrink-0 text-center")}>Off</span>, text: "Approved time off. Off? means it's still a request." },
    {
        sample: <span className={cn(styles.unavailable, "h-7 w-24 shrink-0 rounded-md border")} />,
        text: "Hatched: the person said they're unavailable.",
    },
];

const TIPS: [string, string][] = [
    ["Pick a day", "The week strip shows how covered each day is. Tap one to see who's working."],
    ["Fill a spot", "Tap Suggest on a \"needed\" card. People who are free and know the role come first, with a reason for anyone who isn't."],
    ["Add a shift", "Type a time like 9-5, 4p-11p or 17-23. Tick more days to add it on each."],
    ["Change a shift", "Tap a person's card to change the time, swap the person, or copy it to other days."],
    ["Publish", "Everything you change stays with you until you publish. Your team keeps seeing the last published week."],
];

const SHORTCUTS: [string, string][] = [
    ["Arrow keys", "Move between days. In the Week table, between cells too."],
    ["Delete", "In the Week table, take the person off the focused shift."],
    ["z  /  Shift+z", "Undo / redo."],
    ["?", "This help."],
];

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>How this works</DialogTitle>
                    <DialogDescription>Everything is a tap or a typed time. Nothing to drag.</DialogDescription>
                </DialogHeader>
                <dl className="flex flex-col gap-3 text-sm">
                    {TIPS.map(([title, what]) => (
                        <div key={title} className="flex flex-col gap-0.5">
                            <dt className="font-semibold">{title}</dt>
                            <dd className="text-muted-foreground">{what}</dd>
                        </div>
                    ))}
                </dl>
                <div className="flex flex-col gap-3 border-t pt-4">
                    <h3 className="text-sm font-semibold">In the Week table</h3>
                    <ul className="flex flex-col gap-3">
                        {MARKINGS.map((m) => (
                            <li key={m.text} className="flex items-center gap-3 text-sm">
                                {m.sample}
                                <span>{m.text}</span>
                            </li>
                        ))}
                        <li className="flex items-center gap-3 text-sm">
                            <span className="w-24 shrink-0 text-right text-[13px] font-semibold text-destructive tabular-nums">41.5h</span>
                            <span>Hours turn orange in the last 4 before overtime and red once it starts.</span>
                        </li>
                    </ul>
                </div>
                <div className="flex flex-col gap-2 border-t pt-4">
                    <h3 className="text-sm font-semibold">Keyboard</h3>
                    <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                        {SHORTCUTS.map(([keys, what]) => (
                            <div key={keys} className="contents">
                                <dt className="font-medium">{keys}</dt>
                                <dd className="text-muted-foreground">{what}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </DialogContent>
        </Dialog>
    );
}
