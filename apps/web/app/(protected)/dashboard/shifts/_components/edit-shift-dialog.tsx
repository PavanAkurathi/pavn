"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Field, FieldLabel } from "@repo/ui/components/ui/field";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { getLocalParts } from "@/lib/shifts/shift-time";
import type { Shift } from "@/lib/types";
import { editShiftAction } from "../_actions/edit-shift";

interface EditShiftDialogProps {
    shift: Shift;
    /** How many people are on it now — capacity cannot drop below this. */
    assignedCount: number;
}

/**
 * Change a shift that already exists.
 *
 * The times shown and typed are the times at the site, not wherever the manager
 * is sitting — they go up as wall clock and the server places them using the
 * shift's timezone. Moving a published shift is announced to whoever is on it,
 * and the dialog says so before it happens, because a worker who is not told is
 * a worker who turns up at the wrong hour.
 */
export function EditShiftDialog({ shift, assignedCount }: EditShiftDialogProps) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const { confirm, confirmDialog } = useConfirm();

    const initial = React.useMemo(() => {
        const start = getLocalParts(new Date(shift.startTime), shift.timezone);
        const end = getLocalParts(new Date(shift.endTime), shift.timezone);
        return {
            title: shift.title,
            date: start.date,
            startTime: start.time,
            endTime: end.time,
            capacityTotal: String(shift.capacity?.total ?? 1),
        };
    }, [shift]);

    const [form, setForm] = React.useState(initial);

    const openDialog = () => {
        setForm(initial);
        setOpen(true);
    };

    const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
        setForm((current) => ({ ...current, [key]: event.target.value }));

    const capacity = Number.parseInt(form.capacityTotal, 10);
    const capacityTooLow = Number.isFinite(capacity) && capacity < assignedCount;
    const timeChanged =
        form.date !== initial.date ||
        form.startTime !== initial.startTime ||
        form.endTime !== initial.endTime;
    const dirty = timeChanged || form.title !== initial.title || form.capacityTotal !== initial.capacityTotal;
    const isPublished = shift.status !== "draft";

    const handleSave = async () => {
        if (timeChanged && isPublished && assignedCount > 0) {
            const ok = await confirm({
                title: "Move this shift?",
                description: `${assignedCount} assigned ${assignedCount === 1 ? "person" : "people"} were told the old time. Anyone with the app is re-notified; anyone invited or from an agency you will need to tell yourself.`,
                confirmLabel: "Move it",
            });
            if (!ok) return;
        }

        setIsSaving(true);
        try {
            const result = await editShiftAction(shift.id, {
                title: form.title.trim() || undefined,
                capacityTotal: Number.isFinite(capacity) ? capacity : undefined,
                local: timeChanged
                    ? { date: form.date, startTime: form.startTime, endTime: form.endTime }
                    : undefined,
            });

            if ("error" in result) {
                toast.error(result.error);
                return;
            }

            const tail = result.timeChanged
                ? result.notified > 0
                    ? ` ${result.notified} ${result.notified === 1 ? "person" : "people"} re-notified.`
                    : result.unreachable > 0
                        ? ` ${result.unreachable} assigned ${result.unreachable === 1 ? "person has" : "people have"} no app — tell them yourself.`
                        : ""
                : "";
            toast.success(`Shift updated.${tail}`);
            setOpen(false);
            router.refresh();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <Button variant="outline" onClick={openDialog}>
                <Pencil data-icon="inline-start" />
                Edit shift
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit shift</DialogTitle>
                        <DialogDescription>
                            Times are at {shift.locationName || "the site"}
                            {shift.timezone ? ` (${shift.timezone.split("/").pop()?.replace(/_/g, " ")})` : ""}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <Field>
                            <FieldLabel htmlFor="edit-shift-title">Role</FieldLabel>
                            <Input id="edit-shift-title" value={form.title} onChange={set("title")} maxLength={200} />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="edit-shift-date">Date</FieldLabel>
                            <Input id="edit-shift-date" type="date" value={form.date} onChange={set("date")} />
                        </Field>

                        <div className="grid grid-cols-2 gap-3">
                            <Field>
                                <FieldLabel htmlFor="edit-shift-start">Starts</FieldLabel>
                                <Input id="edit-shift-start" type="time" value={form.startTime} onChange={set("startTime")} />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="edit-shift-end">Ends</FieldLabel>
                                <Input id="edit-shift-end" type="time" value={form.endTime} onChange={set("endTime")} />
                            </Field>
                        </div>

                        <Field>
                            <FieldLabel htmlFor="edit-shift-capacity">People needed</FieldLabel>
                            <Input
                                id="edit-shift-capacity"
                                type="number"
                                min={Math.max(assignedCount, 1)}
                                max={500}
                                value={form.capacityTotal}
                                onChange={set("capacityTotal")}
                            />
                            {capacityTooLow ? (
                                <p className="text-xs font-medium text-destructive">
                                    {assignedCount} already assigned — remove someone first to go lower.
                                </p>
                            ) : null}
                        </Field>

                        {form.endTime <= form.startTime ? (
                            <p className="text-xs text-muted-foreground">
                                Ends before it starts, so this runs overnight into the next day.
                            </p>
                        ) : null}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!dirty || capacityTooLow || isSaving}>
                            {isSaving ? "Saving…" : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {confirmDialog}
        </>
    );
}
