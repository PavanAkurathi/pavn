"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { useCrewData } from "@/hooks/use-crew-data";
import { getDashboardShiftsHref, getSchedulerHref } from "@/lib/routes";
import { postSchedulerChanges } from "@/lib/scheduler/client";
import { newShiftId } from "@/lib/scheduler/plans";
import { usePublish } from "@/lib/scheduler/use-publish";
import { weekStartOf } from "@/lib/shifts/draft-groups";
import type { Location } from "@/lib/types";

interface NewShiftButtonProps {
    locations: Location[];
    /** First day of the week, 0 = Sunday: the week a new shift is published with. */
    weekStartsOn?: number;
}

type Target = { locationId: string; weekStart: string; /** Tells one publish from the next. */ at: number };

/**
 * Publishes a week the moment it mounts, with the Scheduler's one-click
 * publish: an undo window first, and a week with a conflict opens in the
 * Scheduler instead. It stays mounted for the window, because leaving sends.
 */
function PublishWeekNow({ target, onDone }: { target: Target; onDone: () => void }) {
    const router = useRouter();
    const started = React.useRef(false);
    const { start } = usePublish({
        week: { weekStart: target.weekStart, location: { id: target.locationId } },
        onNeedsReview: () => {
            toast("Something in this week needs a look before it can go out.");
            router.push(getSchedulerHref({ location: target.locationId, week: target.weekStart }));
            onDone();
        },
        onPublished: async () => {
            router.refresh();
            onDone();
        },
    });

    React.useEffect(() => {
        if (started.current) return;
        started.current = true;
        void start();
    }, [start]);

    return null;
}

const todayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function NewShiftButton({ locations, weekStartsOn = 0 }: NewShiftButtonProps) {
    const router = useRouter();
    const { crew } = useCrewData();
    const [open, setOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [publishing, setPublishing] = React.useState<Target | null>(null);

    const [role, setRole] = React.useState("");
    const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "");
    const [date, setDate] = React.useState(todayLocal);
    const [startLocal, setStartLocal] = React.useState("09:00");
    const [endLocal, setEndLocal] = React.useState("17:00");
    const [need, setNeed] = React.useState("1");

    const roleOptions = React.useMemo(() => [...new Set(crew.flatMap((worker) => worker.roles))].sort(), [crew]);

    const needCount = Math.floor(Number(need));
    const valid = role.trim() !== "" && Boolean(locationId) && Boolean(date) && Number.isFinite(needCount) && needCount >= 1;

    const save = async (publish: boolean) => {
        if (!valid || saving) return;
        setSaving(true);
        try {
            await postSchedulerChanges(
                [
                    {
                        op: "create",
                        shiftId: newShiftId(),
                        shift: {
                            locationId,
                            localDate: date,
                            startLocal,
                            endLocal,
                            role: role.trim(),
                            capacity: needCount,
                        },
                        assignees: [],
                    },
                ],
                false,
            );
            setOpen(false);
            setRole("");
            if (publish) {
                setPublishing({ locationId, weekStart: weekStartOf(date, weekStartsOn), at: Date.now() });
            } else {
                router.refresh();
                toast.success("Draft saved. It's in the Drafts tab.", {
                    action: { label: "View", onClick: () => router.push(getDashboardShiftsHref({ view: "drafts" })) },
                });
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't save the shift");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Button
                className="font-bold"
                onClick={() => setOpen(true)}
                disabled={locations.length === 0}
                title={locations.length === 0 ? "Add a location first" : undefined}
            >
                <Plus data-icon="inline-start" aria-hidden="true" />
                New shift
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-extrabold">New shift</DialogTitle>
                        <DialogDescription>
                            Starts as a draft. Publish when it&apos;s ready, or publish right away.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        className="space-y-3.5"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void save(false);
                        }}
                    >
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1.5">
                                <Label htmlFor="new-shift-role" className="text-xs font-bold text-muted-foreground">
                                    Role
                                </Label>
                                <Input
                                    id="new-shift-role"
                                    list="new-shift-roles"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    placeholder="e.g. Server"
                                    autoComplete="off"
                                    maxLength={60}
                                />
                                <datalist id="new-shift-roles">
                                    {roleOptions.map((r) => (
                                        <option key={r} value={r} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="new-shift-location" className="text-xs font-bold text-muted-foreground">
                                    Location
                                </Label>
                                <Select value={locationId} onValueChange={setLocationId}>
                                    <SelectTrigger id="new-shift-location" aria-label="Location" className="w-full">
                                        <SelectValue placeholder="Location" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations.map((l) => (
                                            <SelectItem key={l.id} value={l.id}>
                                                {l.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="new-shift-date" className="text-xs font-bold text-muted-foreground">
                                Date
                            </Label>
                            <Input id="new-shift-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1.5">
                                <Label htmlFor="new-shift-start" className="text-xs font-bold text-muted-foreground">
                                    Start
                                </Label>
                                <Input id="new-shift-start" type="time" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="new-shift-end" className="text-xs font-bold text-muted-foreground">
                                    End
                                </Label>
                                <Input id="new-shift-end" type="time" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="new-shift-need" className="text-xs font-bold text-muted-foreground">
                                Workers needed
                            </Label>
                            <Input
                                id="new-shift-need"
                                type="number"
                                min={1}
                                max={200}
                                inputMode="numeric"
                                value={need}
                                onChange={(e) => setNeed(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-2.5 pt-2">
                            <Button type="submit" variant="outline" className="flex-1 font-bold" disabled={!valid || saving}>
                                Save as draft
                            </Button>
                            <Button
                                type="button"
                                className="flex-1 font-bold"
                                disabled={!valid || saving}
                                onClick={() => void save(true)}
                            >
                                Publish now
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {publishing ? <PublishWeekNow key={publishing.at} target={publishing} onDone={() => setPublishing(null)} /> : null}
        </>
    );
}
