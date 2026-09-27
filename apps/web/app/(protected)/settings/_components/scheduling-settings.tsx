"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    BUSINESS_TYPE_PRESETS,
    type OvertimePolicy,
    type SchedulingSettings,
    type UpdateSchedulingSettings,
} from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Switch } from "@repo/ui/components/ui/switch";
import { saveSchedulingSettings, saveSchedulingSetup } from "@/actions/scheduling";
import { ChoiceCards } from "@/components/scheduling/choice-cards";
import { SchedulingQuestions } from "@/components/scheduling/scheduling-questions";
import { DepartmentEditor } from "./department-editor";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const OVERTIME_CHOICES: { value: OvertimePolicy; label: string; summary: string }[] = [
    { value: "weekly_40", label: "Over 40 hours a week", summary: "The federal rule and most states." },
    { value: "daily_8", label: "Over 8 hours in a day", summary: "Daily overtime, as in California." },
];

type Form = Omit<SchedulingSettings, "departments">;

const formOf = (s: SchedulingSettings): Form => ({
    businessType: s.businessType,
    scheduleStyle: s.scheduleStyle,
    openShiftClaimPolicy: s.openShiftClaimPolicy,
    swapApprovalRequired: s.swapApprovalRequired,
    weekStartsOn: s.weekStartsOn,
    overtimePolicy: s.overtimePolicy,
});

function changesBetween(saved: Form, draft: Form): UpdateSchedulingSettings {
    const changes: Record<string, unknown> = {};
    for (const key of Object.keys(draft) as (keyof Form)[]) {
        if (draft[key] !== saved[key] && draft[key] !== null) changes[key] = draft[key];
    }
    return changes as UpdateSchedulingSettings;
}

export function SchedulingSettingsView({
    settings,
    canManage,
}: {
    settings: SchedulingSettings | null;
    canManage: boolean;
}) {
    if (!settings) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Scheduling</CardTitle>
                    <CardDescription>Scheduling settings could not be loaded. Refresh the page to try again.</CardDescription>
                </CardHeader>
            </Card>
        );
    }
    // Remount on fresh server data so the draft starts from what was saved.
    return <SchedulingSettingsForm key={JSON.stringify(formOf(settings))} settings={settings} canManage={canManage} />;
}

function SchedulingSettingsForm({ settings, canManage }: { settings: SchedulingSettings; canManage: boolean }) {
    const router = useRouter();
    const saved = useMemo(() => formOf(settings), [settings]);
    const [draft, setDraft] = useState<Form>(saved);
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);

    const changes = changesBetween(saved, draft);
    const dirty = Object.keys(changes).length > 0;
    const readOnly = !canManage || saving;

    const save = async () => {
        setSaving(true);
        try {
            const result = await saveSchedulingSettings(changes);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success("Scheduling settings saved.");
            router.refresh();
        } finally {
            setSaving(false);
        }
    };

    const seedStarterDepartments = async () => {
        if (!draft.businessType) return;
        setSeeding(true);
        try {
            const result = await saveSchedulingSetup({
                businessType: draft.businessType,
                scheduleStyle: draft.scheduleStyle,
                openShiftClaimPolicy: draft.openShiftClaimPolicy,
            });
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success("Starter departments added.");
            router.refresh();
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>How you schedule</CardTitle>
                    <CardDescription>
                        These answers set sensible defaults. Each manager can still switch views in the Scheduler.
                        {!canManage ? " Only admins can change them." : null}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-8">
                    <SchedulingQuestions
                        value={draft}
                        disabled={readOnly}
                        onChange={(answers) => setDraft({ ...draft, ...answers })}
                        businessTypeHint={
                            settings.departments.length
                                ? "Changing this doesn't touch your departments below."
                                : undefined
                        }
                    />

                    <section className="flex flex-col gap-3" aria-labelledby="q-overtime">
                        <div className="flex flex-col gap-1">
                            <h3 id="q-overtime" className="text-base font-semibold text-foreground">
                                When does overtime start?
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                The Scheduler warns before someone crosses it. Timesheets use the same rule.
                            </p>
                        </div>
                        <ChoiceCards
                            name="overtime"
                            aria-labelledby="q-overtime"
                            value={draft.overtimePolicy}
                            choices={OVERTIME_CHOICES}
                            disabled={readOnly}
                            onChange={(overtimePolicy) => setDraft({ ...draft, overtimePolicy })}
                        />
                    </section>

                    <div className="grid gap-6 sm:grid-cols-2">
                        <Field>
                            <FieldLabel htmlFor="week-starts-on">Week starts on</FieldLabel>
                            <Select
                                value={String(draft.weekStartsOn)}
                                disabled={readOnly}
                                onValueChange={(value) => setDraft({ ...draft, weekStartsOn: Number(value) })}
                            >
                                <SelectTrigger id="week-starts-on" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {WEEKDAYS.map((day, index) => (
                                        <SelectItem key={day} value={String(index)}>
                                            {day}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldDescription>The first column of every schedule, and where weekly hours reset.</FieldDescription>
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between gap-4">
                                <FieldLabel htmlFor="swap-approval">Approve shift swaps</FieldLabel>
                                <Switch
                                    id="swap-approval"
                                    checked={draft.swapApprovalRequired}
                                    disabled={readOnly}
                                    onCheckedChange={(swapApprovalRequired) => setDraft({ ...draft, swapApprovalRequired })}
                                />
                            </div>
                            <FieldDescription>
                                {draft.swapApprovalRequired
                                    ? "After two people agree to swap, it waits for a manager."
                                    : "A swap goes through as soon as both people agree."}
                            </FieldDescription>
                        </Field>
                    </div>
                </CardContent>
                {canManage ? (
                    <CardFooter className="justify-end gap-2 border-t pt-6">
                        {dirty ? (
                            <Button type="button" variant="ghost" disabled={saving} onClick={() => setDraft(saved)}>
                                Undo changes
                            </Button>
                        ) : null}
                        <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
                            {saving ? <Spinner data-icon="inline-start" /> : null}
                            Save
                        </Button>
                    </CardFooter>
                ) : null}
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Departments</CardTitle>
                    <CardDescription>
                        Groups of roles, like Kitchen or Front of house. People land in a department through their roles, so
                        there is nobody to move by hand. A department with no roles takes everyone the others don&apos;t.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {settings.departments.length === 0 && canManage && draft.businessType ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4">
                            <p className="text-sm text-muted-foreground">
                                Start with the usual {BUSINESS_TYPE_PRESETS[draft.businessType].label.toLowerCase()} departments:{" "}
                                {BUSINESS_TYPE_PRESETS[draft.businessType].departments.map((d) => d.name).join(", ")}.
                            </p>
                            <Button type="button" variant="outline" disabled={seeding} onClick={() => void seedStarterDepartments()}>
                                {seeding ? <Spinner data-icon="inline-start" /> : null}
                                Use these
                            </Button>
                        </div>
                    ) : null}
                    <DepartmentEditor departments={settings.departments} canManage={canManage} />
                </CardContent>
            </Card>
        </div>
    );
}
