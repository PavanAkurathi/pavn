// apps/web/components/settings/business-form.tsx

"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import {
    Field,
    FieldGroup,
    FieldLabel,
} from "@repo/ui/components/ui/field";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { updateOrganization } from "@/actions/organization";

export interface BusinessFormProps {
    organization: {
        name: string;
        metadata?: string | null; // metadata is text in schema, usually JSON string
        attendanceVerificationPolicy?: "strict_geofence" | "soft_geofence" | "none" | null;
    } | null;
}

export function BusinessForm({ organization }: BusinessFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [businessName, setBusinessName] = useState(organization?.name || "");

    // Parse metadata if it's a JSON string
    const getInitialDescription = () => {
        if (!organization?.metadata) return "";
        try {
            const parsed = JSON.parse(organization.metadata);
            // If it's an object with a description field, use that
            if (typeof parsed === "object" && parsed !== null && "description" in parsed) {
                return parsed.description;
            }
            // If it's just a string wrapped in JSON
            if (typeof parsed === "string") return parsed;
            return organization.metadata;
        } catch {
            return organization.metadata;
        }
    };

    const [description, setDescription] = useState(getInitialDescription());
    const [attendanceVerificationPolicy, setAttendanceVerificationPolicy] = useState<
        "strict_geofence" | "soft_geofence" | "none"
    >(organization?.attendanceVerificationPolicy || "strict_geofence");

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const result = await updateOrganization({
                name: businessName,
                metadata: description,
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
            <CardContent>
                <form onSubmit={handleSave} className="space-y-6">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="business_name">Business Name</FieldLabel>
                            <Input
                                id="business_name"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                placeholder="Acme Inc."
                                className="bg-white"
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="description">Description</FieldLabel>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe your business..."
                                className="bg-white min-h-[100px]"
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="attendance_verification_policy">Clock-in verification</FieldLabel>
                            <Select
                                value={attendanceVerificationPolicy}
                                onValueChange={(value) =>
                                    setAttendanceVerificationPolicy(value as "strict_geofence" | "soft_geofence" | "none")
                                }
                            >
                                <SelectTrigger id="attendance_verification_policy" className="bg-white">
                                    <SelectValue placeholder="Select verification rule" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="strict_geofence">On-site required</SelectItem>
                                    <SelectItem value="soft_geofence">Flexible on-site</SelectItem>
                                    <SelectItem value="none">No location check</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground">
                                On-site required blocks punches outside the job location. Flexible on-site allows the punch and flags it for review. No location check records time without enforcing venue location.
                            </p>
                        </Field>
                    </FieldGroup>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
