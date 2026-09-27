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

const MARKINGS: { sample: React.ReactNode; text: string }[] = [
    { sample: <Sample><span className={styles.time}>4p–11p</span></Sample>, text: "Published. Staff see it in the app." },
    {
        sample: (
            <Sample className={styles.draft}>
                <span className={styles.time}>4p–11p</span>
            </Sample>
        ),
        text: "Stripes: not published yet. Staff can't see it.",
    },
    {
        sample: (
            <Sample>
                <span className={styles.time}>4p–11p</span>
                <span className={styles.edited} />
            </Sample>
        ),
        text: "Amber dot: published, with changes staff can't see yet.",
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
                <span className={cn(styles.fill, "text-destructive")}>2</span>
            </Sample>
        ),
        text: "Dashed: open slots nobody has taken yet.",
    },
    { sample: <span className={cn(styles.off, "w-24 shrink-0 text-center")}>Off</span>, text: "Approved time off. Off? means it's still a request." },
    {
        sample: <span className={cn(styles.unavailable, "h-7 w-24 shrink-0 rounded-md border")} />,
        text: "Hatched: the person said they're unavailable. Hover for the times.",
    },
];

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>What the markings mean</DialogTitle>
                    <DialogDescription>
                        Softer warnings, like someone nearing overtime or not trained for a role, show when you hover or open a
                        shift, so the grid stays quiet.
                    </DialogDescription>
                </DialogHeader>
                <ul className="flex flex-col gap-3">
                    {MARKINGS.map((m) => (
                        <li key={m.text} className="flex items-center gap-3 text-sm">
                            {m.sample}
                            <span>{m.text}</span>
                        </li>
                    ))}
                    <li className="flex items-center gap-3 text-sm">
                        <span className="w-24 shrink-0 text-right text-[13px] font-semibold text-destructive tabular-nums">41.5h</span>
                        <span>Hours turn amber in the last 4 before overtime and red once it starts.</span>
                    </li>
                </ul>
            </DialogContent>
        </Dialog>
    );
}
