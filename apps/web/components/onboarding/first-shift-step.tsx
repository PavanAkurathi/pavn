"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@repo/ui/components/ui/card";
import { SUBSCRIPTION } from "@repo/config";
import { getCreateScheduleHref, getRosterHref } from "@/lib/routes";

export function FirstShiftStep({
    hasDraftShift,
    mockMode = false,
}: {
    hasDraftShift: boolean;
    mockMode?: boolean;
}) {
    return (
        <Card className="rounded-[28px] border-border/70 shadow-lg shadow-black/5">
            <CardHeader className="gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Finish line</Badge>
                    <Badge variant="outline">{SUBSCRIPTION.TRIAL_DAYS}-day free trial active</Badge>
                </div>
                <div className="flex flex-col gap-2">
                    <CardTitle>Publish your first live shift</CardTitle>
                    <CardDescription>
                        Drafts help you plan, but publishing the first live shift is what completes onboarding.
                        After that, the remaining setup becomes a follow-up checklist instead of a redirect wall.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <Alert>
                    <ClipboardList className="h-4 w-4" />
                    <AlertTitle>Go from plan to live operation</AlertTitle>
                    <AlertDescription>
                        Create the schedule, assign workers if you want, and publish the first live shift when the lineup is ready.
                    </AlertDescription>
                </Alert>

                <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Billing and manager invites can wait</AlertTitle>
                    <AlertDescription>
                        The product should prove value before you finish every admin task. Once the first live shift exists, you can keep refining the workspace from the dashboard.
                    </AlertDescription>
                </Alert>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-3">
                {mockMode ? (
                    <>
                        <Button
                            type="button"
                            size="lg"
                            onClick={() =>
                                toast.info(
                                    "Mock mode stops at onboarding. Schedule creation is still live-only.",
                                )
                            }
                        >
                            {hasDraftShift ? "Continue draft schedule" : "Create your first schedule"}
                            <ArrowRight data-icon="inline-end" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                                toast.info(
                                    "Mock mode keeps onboarding isolated from the roster workspace.",
                                )
                            }
                        >
                            <Sparkles data-icon="inline-start" />
                            Review workforce again
                        </Button>
                    </>
                ) : (
                    <>
                        <Button asChild size="lg">
                            <Link href={getCreateScheduleHref()}>
                                {hasDraftShift ? "Continue draft schedule" : "Create your first schedule"}
                                <ArrowRight data-icon="inline-end" />
                            </Link>
                        </Button>
                        <Button asChild variant="ghost">
                            <Link href={getRosterHref({ onboarding: "roster" })}>
                                <Sparkles data-icon="inline-start" />
                                Review workforce again
                            </Link>
                        </Button>
                    </>
                )}
            </CardFooter>
        </Card>
    );
}
