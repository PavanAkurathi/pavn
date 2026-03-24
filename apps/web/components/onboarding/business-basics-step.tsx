"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@repo/ui/components/ui/card";
import {
    Field,
    FieldGroup,
    FieldLabel,
} from "@repo/ui/components/ui/field";
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
    const [isHydrated, setIsHydrated] = useState(false);
    const [businessName, setBusinessName] = useState(organizationName);
    const [businessTimezone, setBusinessTimezone] = useState(timezone);
    const [attendancePolicy, setAttendancePolicy] = useState<AttendancePolicy>(attendanceVerificationPolicy);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

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
        <Card className="border-slate-200 shadow-sm">
            <CardHeader>
                <CardTitle>Business basics</CardTitle>
                <CardDescription>
                    Confirm the business settings that affect schedules, timezone handling, and clock-in behavior before you move into location setup and your first schedule.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="onboarding_business_name">Business Name</FieldLabel>
                            <Input
                                id="onboarding_business_name"
                                value={businessName}
                                onChange={(event) => setBusinessName(event.target.value)}
                                placeholder="Acme Staffing"
                                className="bg-white"
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="onboarding_timezone">Timezone</FieldLabel>
                            <Input
                                id="onboarding_timezone"
                                value={businessTimezone}
                                onChange={(event) => setBusinessTimezone(event.target.value)}
                                placeholder="America/New_York"
                                className="bg-white"
                            />
                            <p className="text-sm text-muted-foreground">
                                Use an IANA timezone like <span className="font-medium text-slate-700">America/New_York</span>.
                            </p>
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="onboarding_attendance_policy">Clock-in verification</FieldLabel>
                            <Select
                                value={attendancePolicy}
                                onValueChange={(value) => setAttendancePolicy(value as AttendancePolicy)}
                            >
                                <SelectTrigger id="onboarding_attendance_policy" className="bg-white">
                                    <SelectValue placeholder="Select verification rule" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="strict_geofence">On-site required</SelectItem>
                                    <SelectItem value="soft_geofence">Flexible on-site</SelectItem>
                                    <SelectItem value="none">No location check</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground">
                                Choose whether workers must be on-site, can clock in flexibly, or can record time without location enforcement.
                            </p>
                        </Field>
                    </FieldGroup>

                    <div className="flex flex-wrap gap-3">
                        <Button
                            type="button"
                            size="lg"
                            className="gap-2 rounded-full px-8"
                            disabled={isSaving || !isHydrated}
                            onClick={() => {
                                void handleSubmit();
                            }}
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Save and continue
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
