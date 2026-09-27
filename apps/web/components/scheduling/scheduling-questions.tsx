"use client";

import {
    BUSINESS_TYPE_PRESETS,
    OPEN_SHIFT_CLAIM_OPTIONS,
    SCHEDULE_STYLE_OPTIONS,
    type BusinessType,
    type OpenShiftClaimPolicy,
    type ScheduleStyle,
} from "@repo/contracts/scheduler";
import { ChoiceCards, type Choice } from "./choice-cards";

export interface SchedulingAnswers {
    businessType: BusinessType | null;
    scheduleStyle: ScheduleStyle;
    openShiftClaimPolicy: OpenShiftClaimPolicy;
}

const toChoices = <T extends string>(options: Record<T, { label: string; summary: string }>): Choice<T>[] =>
    (Object.keys(options) as T[]).map((value) => ({ value, ...options[value] }));

const businessChoices = toChoices(BUSINESS_TYPE_PRESETS);
const styleChoices = toChoices(SCHEDULE_STYLE_OPTIONS);
const claimChoices = toChoices(OPEN_SHIFT_CLAIM_OPTIONS);

function Question({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-3" aria-labelledby={id}>
            <div className="flex flex-col gap-1">
                <h3 id={id} className="text-base font-semibold text-foreground">
                    {title}
                </h3>
                {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
            </div>
            {children}
        </section>
    );
}

/**
 * The three setup questions. Used by onboarding and by Settings → Scheduling,
 * so a business sees the same wording in both places.
 */
export function SchedulingQuestions({
    value,
    onChange,
    disabled,
    businessTypeHint,
}: {
    value: SchedulingAnswers;
    onChange: (next: SchedulingAnswers) => void;
    disabled?: boolean;
    businessTypeHint?: string;
}) {
    return (
        <div className="flex flex-col gap-8">
            <Question
                id="q-business-type"
                title="What kind of business is this?"
                hint={businessTypeHint ?? "We'll start you with the usual departments and roles. You can rename or change them later."}
            >
                <ChoiceCards
                    name="business-type"
                    aria-labelledby="q-business-type"
                    value={value.businessType}
                    choices={businessChoices}
                    disabled={disabled}
                    onChange={(businessType) => onChange({ ...value, businessType })}
                />
            </Question>

            <Question id="q-schedule-style" title="How does your schedule change week to week?">
                <ChoiceCards
                    name="schedule-style"
                    aria-labelledby="q-schedule-style"
                    value={value.scheduleStyle}
                    choices={styleChoices}
                    disabled={disabled}
                    onChange={(scheduleStyle) => onChange({ ...value, scheduleStyle })}
                />
            </Question>

            <Question id="q-open-shifts" title="When someone picks up an open shift…">
                <ChoiceCards
                    name="open-shift-claims"
                    aria-labelledby="q-open-shifts"
                    value={value.openShiftClaimPolicy}
                    choices={claimChoices}
                    disabled={disabled}
                    onChange={(openShiftClaimPolicy) => onChange({ ...value, openShiftClaimPolicy })}
                />
            </Question>
        </div>
    );
}
