// apps/web/components/settings/business-form.tsx

"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLegend,
    FieldLabel,
    FieldSet,
} from "@repo/ui/components/ui/field";
import { toast } from "sonner";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/ui/toggle-group";

import { updateOrganization } from "@/actions/organization";
import { getOrganizationDescription } from "@/lib/organization-metadata";

export interface BusinessFormProps {
    organization: {
        name: string;
        metadata?: string | null; // metadata is text in schema, usually JSON string
        timezone?: string | null;
        attendanceVerificationPolicy?: "strict_geofence" | "soft_geofence" | "none" | null;
    } | null;
    canManageWorkspace: boolean;
}

export function BusinessForm({ organization, canManageWorkspace }: BusinessFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [businessName, setBusinessName] = useState(organization?.name || "");
    const [timezone, setTimezone] = useState(organization?.timezone || "America/New_York");

    const [description, setDescription] = useState(getOrganizationDescription(organization?.metadata));
    const [attendanceVerificationPolicy, setAttendanceVerificationPolicy] = useState<
        "strict_geofence" | "soft_geofence" | "none"
    >(organization?.attendanceVerificationPolicy || "strict_geofence");

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const result = await updateOrganization({
                name: businessName,
                description,
                timezone,
                attendanceVerificationPolicy,
            });

            if (result.error) {
                toast.error(result.error);
                return;
            }

            toast.success("Business details updated!");
        } catch (error) {
            toast.error("Failed to update business details.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Update your company details and public profile.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSave}>
                <CardContent className="flex flex-col gap-6">
                    {!canManageWorkspace ? (
                        <FieldDescription>
                            Only admins can change business setup and operating rules for this workspace.
                        </FieldDescription>
                    ) : null}
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="business_name">Business name</FieldLabel>
                            <Input
                                id="business_name"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                placeholder="Acme Inc."
                                disabled={!canManageWorkspace}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
                            <Input
                                id="timezone"
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                                placeholder="America/New_York"
                                disabled={!canManageWorkspace}
                            />
                            <FieldDescription>
                                Use an IANA timezone like <span className="font-medium text-foreground">America/New_York</span> or{" "}
                                <span className="font-medium text-foreground">America/Los_Angeles</span>.
                            </FieldDescription>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="description">Description</FieldLabel>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe your business..."
                                className="min-h-[100px]"
                                disabled={!canManageWorkspace}
                            />
                        </Field>
                        <FieldSet>
                            <FieldLegend>Clock-in verification</FieldLegend>
                            <FieldDescription>
                                On-site required blocks punches outside the job location. Flexible on-site allows the punch and flags it for review. No location check records time without enforcing venue location.
                            </FieldDescription>
                            <ToggleGroup
                                type="single"
                                value={attendanceVerificationPolicy}
                                onValueChange={(value) => {
                                    if (value) {
                                        setAttendanceVerificationPolicy(value as "strict_geofence" | "soft_geofence" | "none");
                                    }
                                }}
                                className="justify-start"
                                disabled={!canManageWorkspace}
                            >
                                <ToggleGroupItem value="strict_geofence">On-site required</ToggleGroupItem>
                                <ToggleGroupItem value="soft_geofence">Flexible on-site</ToggleGroupItem>
                                <ToggleGroupItem value="none">No location check</ToggleGroupItem>
                            </ToggleGroup>
                        </FieldSet>
                    </FieldGroup>
                </CardContent>
                <CardFooter className="justify-end">
                    <Button type="submit" disabled={isLoading || !canManageWorkspace}>
                        {isLoading ? <Spinner data-icon="inline-start" /> : null}
                        Save changes
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
