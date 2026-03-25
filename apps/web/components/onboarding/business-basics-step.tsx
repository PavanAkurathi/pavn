"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
    Card,
    CardContent,
    CardFooter,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@repo/ui/components/ui/card";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLegend,
    FieldLabel,
    FieldSet,
} from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/ui/toggle-group";
import { updateOrganization } from "@/actions/organization";

type AttendancePolicy = "strict_geofence" | "soft_geofence" | "none";

export function BusinessBasicsStep({
    organizationName,
    timezone,
    attendanceVerificationPolicy,
    nextHref,
}: {
    organizationName: string;
    timezone: string;
    attendanceVerificationPolicy: AttendancePolicy;
    nextHref: string;
}) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [businessName, setBusinessName] = useState(organizationName);
    const [businessTimezone, setBusinessTimezone] = useState(timezone);
    const [attendancePolicy, setAttendancePolicy] = useState<AttendancePolicy>(attendanceVerificationPolicy);

    const handleSubmit = async () => {
        setIsSaving(true);

        try {
            const result = await updateOrganization({
                name: businessName,
                timezone: businessTimezone,
                attendanceVerificationPolicy: attendancePolicy,
                markBusinessInformationComplete: true,
            });

            if (result?.error) {
                toast.error(result.error);
                return;
            }

            toast.success("Business basics saved.");
            router.push(nextHref);
            router.refresh();
        } catch {
            toast.error("Failed to save business basics.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Business basics</CardTitle>
                <CardDescription>
                    Confirm the business settings that affect schedules, timezone handling, and clock-in behavior before you move into location setup.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="onboarding_business_name">Business name</FieldLabel>
                        <Input
                            id="onboarding_business_name"
                            value={businessName}
                            onChange={(event) => setBusinessName(event.target.value)}
                            placeholder="Acme Staffing"
                        />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="onboarding_timezone">Timezone</FieldLabel>
                        <Input
                            id="onboarding_timezone"
                            value={businessTimezone}
                            onChange={(event) => setBusinessTimezone(event.target.value)}
                            placeholder="America/New_York"
                        />
                        <FieldDescription>
                            Use an IANA timezone like <span className="font-medium text-foreground">America/New_York</span>.
                        </FieldDescription>
                    </Field>

                    <FieldSet>
                        <FieldLegend>Clock-in verification</FieldLegend>
                        <FieldDescription>
                            Choose whether workers must be on-site, can clock in flexibly, or can record time without location enforcement.
                        </FieldDescription>
                        <ToggleGroup
                            type="single"
                            value={attendancePolicy}
                            onValueChange={(value) => {
                                if (value) {
                                    setAttendancePolicy(value as AttendancePolicy);
                                }
                            }}
                            className="justify-start"
                        >
                            <ToggleGroupItem value="strict_geofence">On-site required</ToggleGroupItem>
                            <ToggleGroupItem value="soft_geofence">Flexible on-site</ToggleGroupItem>
                            <ToggleGroupItem value="none">No location check</ToggleGroupItem>
                        </ToggleGroup>
                    </FieldSet>
                </FieldGroup>
            </CardContent>
            <CardFooter>
                <Button
                    type="button"
                    size="lg"
                    disabled={isSaving}
                    onClick={() => {
                        void handleSubmit();
                    }}
                >
                    {isSaving ? <Spinner data-icon="inline-start" /> : null}
                    Save and continue
                </Button>
            </CardFooter>
        </Card>
    );
}
