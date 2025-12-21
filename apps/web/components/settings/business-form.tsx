"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import {
    Field,
    FieldGroup,
    FieldLabel,
} from "@repo/ui/components/ui/field";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { updateOrganization } from "../../app/(protected)/settings/actions";

export interface BusinessFormProps {
    organization: {
        name: string;
        metadata?: string | null; // metadata is text in schema, usually JSON string
    } | null;
}

export function BusinessForm({ organization }: BusinessFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [businessName, setBusinessName] = useState(organization?.name || "");
    const [description, setDescription] = useState(organization?.metadata || ""); // Using metadata for description for now

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const result = await updateOrganization({
                name: businessName,
                metadata: description
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
