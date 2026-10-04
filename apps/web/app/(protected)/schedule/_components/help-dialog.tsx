"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { ShiftCard } from "@repo/ui/components/app/shift-card";
import { cn } from "@repo/ui/lib/utils";
import styles from "./scheduler.module.css";

/** A real card, only not clickable: the legend shows exactly what the grid draws. */
function Sample(props: Omit<React.ComponentProps<typeof ShiftCard>, "time">) {
    return (
        <div className="w-32 shrink-0">
            <ShiftCard tabIndex={-1} aria-hidden title="Server" time="4p–11p" detail="3/4" {...props} />
        </div>
    );
}

const MARKINGS: { sample: React.ReactNode; text: string }[] = [
    { sample: <Sample />, text: "Published. Staff see it in the app." },
    { sample: <Sample draft />, text: "Dashed, tagged DRAFT: not published yet. Staff can't see it." },
    { sample: <Sample edited />, text: "Amber dot: published, with changes staff can't see yet." },
    { sample: <Sample conflict />, text: "Red ring and !: a real problem, like a double booking or approved time off." },
    { sample: <Sample kind="open" openLabel="OPEN · 2 to fill" />, text: "Dashed OPEN card: slots nobody has taken yet." },
    { sample: <Sample event />, text: "◆: part of an event. Click the event's name above the day to staff it." },
    { sample: <span className={cn(styles.off, "w-32 shrink-0 text-center")}>Off</span>, text: "Approved time off. Off? means it's still a request." },
    {
        sample: <span className={cn(styles.unavailable, "h-7 w-32 shrink-0 rounded-md border")} />,
        text: "Hatched: the person said they're unavailable. Hover for the times.",
    },
];

const SHORTCUTS: [string, string][] = [
    ["Click a day", "Add a shift. Type times like 9-5, 4p-11p or 17-23."],
    ["Drag a shift", "Move it to another day or person. Hold Alt (Option) to copy instead."],
    ["Drag to Open", "Take the person off; the spot stays open to fill."],
    ["Arrow keys", "Move between days and people. Enter adds or opens."],
    ["c then v", "Copy the focused shift, paste it on the focused day."],
    ["Delete", "Take the person off the focused shift."],
    ["z  /  Shift+z", "Undo / redo."],
    ["?", "This help."],
];

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Help and shortcuts</DialogTitle>
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
                        <span className="w-32 shrink-0 text-right text-[13px] font-semibold text-destructive tabular-nums">41.5h</span>
                        <span>Hours turn amber in the last 4 before overtime and red once it starts.</span>
                    </li>
                </ul>
                <div className="flex flex-col gap-2 border-t pt-4">
                    <h3 className="text-sm font-semibold">Working fast</h3>
                    <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                        {SHORTCUTS.map(([keys, what]) => (
                            <div key={keys} className="contents">
                                <dt className="font-medium">{keys}</dt>
                                <dd className="text-muted-foreground">{what}</dd>
                            </div>
                        ))}
                    </dl>
                    <p className="text-xs text-muted-foreground">
                        Everything you change is a draft until you publish; staff keep seeing the published week.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
