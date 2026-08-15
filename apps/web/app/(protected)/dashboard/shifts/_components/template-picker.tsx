"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { LayoutTemplate, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { cn } from "@repo/ui/lib/utils";
import { useConfirm } from "@/components/ui/use-confirm";
import type { ShiftTemplateSummary } from "@/lib/api/shifts";
import {
    applyTemplateAction,
    deleteTemplateAction,
    listTemplatesAction,
} from "../_actions/templates";

/** Stable identity, so an unstamped read does not make a new Set every render. */
const EMPTY_DATES: ReadonlySet<string> = new Set();

interface TemplatePickerProps {
    /** Sunday of the week on screen — the days offered are this week's. */
    weekStart: Date;
    onApplied: () => void;
}

/**
 * Put a saved shape onto days.
 *
 * The days offered are the week the manager is already looking at, so applying
 * a template is one dialog rather than a date-picking expedition. It lands as
 * drafts, which is what the publish bar is for.
 */
export function TemplatePicker({ weekStart, onApplied }: TemplatePickerProps) {
    const [open, setOpen] = React.useState(false);
    const [templates, setTemplates] = React.useState<ShiftTemplateSummary[] | null>(null);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [isApplying, setIsApplying] = React.useState(false);
    const { confirm, confirmDialog } = useConfirm();

    const weekKey = format(weekStart, "yyyy-MM-dd");
    const days = React.useMemo(
        () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
        [weekStart],
    );

    // The ticked days are stamped with the week they belong to. Navigating to
    // another week makes them stale, and reading them back through that stamp is
    // simpler — and harder to get wrong — than an effect that clears them.
    const [selection, setSelection] = React.useState<{ week: string; dates: Set<string> }>({
        week: weekKey,
        dates: new Set(),
    });
    const selectedDates = selection.week === weekKey ? selection.dates : EMPTY_DATES;

    const openDialog = async (next: boolean) => {
        setOpen(next);
        if (next && templates === null) {
            setTemplates(await listTemplatesAction());
        }
    };

    const selected = templates?.find((template) => template.id === selectedId) ?? null;

    const toggleDay = (key: string) => {
        setSelection((current) => {
            const dates = new Set(current.week === weekKey ? current.dates : []);
            if (dates.has(key)) dates.delete(key);
            else dates.add(key);
            return { week: weekKey, dates };
        });
    };

    const handleApply = async () => {
        if (!selected || selectedDates.size === 0) return;

        setIsApplying(true);
        try {
            const result = await applyTemplateAction(selected.id, [...selectedDates].sort());

            if ("error" in result) {
                toast.error(result.error);
                return;
            }

            if (result.created === 0) {
                toast.info(result.message ?? "Nothing to add — those days already have shifts.");
                return;
            }

            const skipped = result.skippedDays.length
                ? `, skipped ${result.skippedDays.length} day${result.skippedDays.length === 1 ? "" : "s"} that already had shifts`
                : "";
            toast.success(
                `Added ${result.created} draft shift${result.created === 1 ? "" : "s"} across ${result.days} day${result.days === 1 ? "" : "s"}${skipped}. Review and publish when ready.`,
            );
            setOpen(false);
            setSelection({ week: weekKey, dates: new Set() });
            onApplied();
        } finally {
            setIsApplying(false);
        }
    };

    const handleDelete = async (template: ShiftTemplateSummary) => {
        const ok = await confirm({
            title: `Delete "${template.name}"?`,
            description: "Shifts already created from it are not affected.",
            confirmLabel: "Delete template",
            destructive: true,
        });
        if (!ok) return;

        const result = await deleteTemplateAction(template.id);
        if ("error" in result) {
            toast.error(result.error);
            return;
        }
        if (selectedId === template.id) setSelectedId(null);
        setTemplates((current) => current?.filter((item) => item.id !== template.id) ?? null);
        toast.success("Template deleted.");
    };

    return (
        <>
            <Dialog open={open} onOpenChange={openDialog}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" title="Put a saved shift shape onto days">
                        <LayoutTemplate data-icon="inline-start" aria-hidden="true" />
                        Use a template
                    </Button>
                </DialogTrigger>

                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Use a template</DialogTitle>
                        <DialogDescription>
                            Pick a shape, pick the days. It lands as drafts — nobody is told until you publish.
                        </DialogDescription>
                    </DialogHeader>

                    {templates === null ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
                    ) : templates.length === 0 ? (
                        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
                            <p className="text-sm font-medium text-foreground">No templates yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Open a shift you run often and choose <span className="font-medium">Save as template</span>.
                                It keeps the roles, headcount and hours — never the people.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                {templates.map((template) => (
                                    <div
                                        key={template.id}
                                        className={cn(
                                            "flex items-center gap-2 rounded-lg border p-3 text-left transition",
                                            selectedId === template.id
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-border/90",
                                        )}
                                    >
                                        <button
                                            type="button"
                                            className="min-w-0 flex-1 text-left"
                                            onClick={() => setSelectedId(template.id)}
                                            aria-pressed={selectedId === template.id}
                                        >
                                            <p className="truncate text-sm font-semibold text-foreground">
                                                {template.name}
                                            </p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {template.startTime}–{template.endTime} · {template.locationName} ·{" "}
                                                {template.headcount} {template.headcount === 1 ? "person" : "people"} across{" "}
                                                {template.positions.length}{" "}
                                                {template.positions.length === 1 ? "role" : "roles"}
                                            </p>
                                        </button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDelete(template)}
                                            aria-label={`Delete ${template.name}`}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            {selected ? (
                                <div>
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Which days
                                    </p>
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {days.map((day) => {
                                            const key = format(day, "yyyy-MM-dd");
                                            const isOn = selectedDates.has(key);
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => toggleDay(key)}
                                                    aria-pressed={isOn}
                                                    className={cn(
                                                        "flex flex-col items-center rounded-lg border py-2 text-xs transition",
                                                        isOn
                                                            ? "border-primary bg-primary text-primary-foreground"
                                                            : "border-border text-muted-foreground hover:border-primary/40",
                                                    )}
                                                >
                                                    <span className="font-semibold uppercase">{format(day, "EEE")}</span>
                                                    <span className="tabular-nums">{format(day, "d")}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApply}
                            disabled={!selected || selectedDates.size === 0 || isApplying}
                        >
                            {isApplying ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding…
                                </>
                            ) : selected && selectedDates.size > 0 ? (
                                // One draft per role per day — the same unit the
                                // result reports back, so the button does not
                                // promise a different number than it delivers.
                                `Add ${selected.positions.length * selectedDates.size} draft shifts`
                            ) : (
                                "Add drafts"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {confirmDialog}
        </>
    );
}
