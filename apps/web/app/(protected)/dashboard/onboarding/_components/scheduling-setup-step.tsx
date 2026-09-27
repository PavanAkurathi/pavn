"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DEFAULT_SCHEDULING_SETUP } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardFooter } from "@repo/ui/components/ui/card";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { saveSchedulingSetup } from "@/actions/scheduling";
import { SchedulingQuestions, type SchedulingAnswers } from "@/components/scheduling/scheduling-questions";

export function SchedulingSetupStep({
    initial,
    backHref,
    nextHref,
}: {
    initial: SchedulingAnswers;
    backHref: string;
    nextHref: string;
}) {
    const router = useRouter();
    const [answers, setAnswers] = useState<SchedulingAnswers>(initial);
    const [saving, setSaving] = useState<"save" | "skip" | null>(null);

    const submit = async (mode: "save" | "skip") => {
        const payload = mode === "skip" ? DEFAULT_SCHEDULING_SETUP : answers;
        if (!payload.businessType) return;

        setSaving(mode);
        try {
            const result = await saveSchedulingSetup({ ...payload, businessType: payload.businessType });
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success(mode === "skip" ? "Using restaurant defaults. Change them any time in Settings." : "Scheduling is set up.");
            router.push(nextHref);
            router.refresh();
        } finally {
            setSaving(null);
        }
    };

    return (
        <Card className="rounded-[28px] border-border/70 shadow-lg shadow-black/5">
            <CardContent className="pt-6">
                <SchedulingQuestions value={answers} onChange={setAnswers} disabled={saving !== null} />
            </CardContent>
            <CardFooter className="flex-wrap justify-between gap-3 border-t border-border/60 pt-6">
                <Button type="button" variant="outline" onClick={() => router.push(backHref)} disabled={saving !== null}>
                    Back
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={saving !== null}
                        onClick={() => void submit("skip")}
                    >
                        {saving === "skip" ? <Spinner data-icon="inline-start" /> : null}
                        Skip for now
                    </Button>
                    <Button
                        type="button"
                        size="lg"
                        disabled={saving !== null || !answers.businessType}
                        onClick={() => void submit("save")}
                    >
                        {saving === "save" ? <Spinner data-icon="inline-start" /> : null}
                        Save and continue
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
