"use client";

import Link from "next/link";
import { ArrowRight, Upload, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@repo/ui/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { getOnboardingHref, getRosterHref } from "@/lib/routes";

export function WorkforceSetupStep({
    mockMode = false,
}: {
    mockMode?: boolean;
}) {
    const router = useRouter();

    return (
        <Card className="rounded-[28px] border-border/70 shadow-lg shadow-black/5">
            <CardHeader className="gap-4">
                <div className="flex flex-col gap-2">
                    <CardTitle>Build your workforce</CardTitle>
                    <CardDescription>
                        Add the first workers who need mobile access. This can be a manual add, a CSV import,
                        or a staged roster entry. You do not need perfect data for every worker before you keep moving.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <Alert>
                    <Users className="h-4 w-4" />
                    <AlertTitle>Worker access is separate from team access</AlertTitle>
                    <AlertDescription>
                        Admins and managers belong in <span className="font-medium text-foreground">Settings → Team</span>.
                        Your roster is for frontline workers who need shift visibility and mobile attendance.
                    </AlertDescription>
                </Alert>

                <Alert>
                    <Upload className="h-4 w-4" />
                    <AlertTitle>Pending roster entries are enough to move forward</AlertTitle>
                    <AlertDescription>
                        You do not need to finish every profile. If the business has started adding workers, you can move on to creating the first live shift.
                    </AlertDescription>
                </Alert>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-3">
                {mockMode ? (
                    <>
                        <Button
                            type="button"
                            size="lg"
                            onClick={() => router.push(getOnboardingHref({ step: "first_shift", mock: true }))}
                        >
                            Continue to first shift
                            <ArrowRight data-icon="inline-end" />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                toast.info(
                                    "Mock mode keeps onboarding self-contained. Roster pages stay live-only for now.",
                                )
                            }
                        >
                            Import roster CSV
                            <ArrowRight data-icon="inline-end" />
                        </Button>
                    </>
                ) : (
                    <>
                        <Button asChild size="lg">
                            <Link href={getRosterHref({ onboarding: "roster" })}>
                                Open roster workspace
                                <ArrowRight data-icon="inline-end" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/rosters/import">
                                Import roster CSV
                                <ArrowRight data-icon="inline-end" />
                            </Link>
                        </Button>
                    </>
                )}
            </CardFooter>
        </Card>
    );
}
