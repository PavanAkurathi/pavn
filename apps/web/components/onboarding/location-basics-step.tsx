"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
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
    FieldLabel,
} from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { createLocation } from "@/actions/locations";

export function LocationBasicsStep({
    timezone,
    nextHref,
}: {
    timezone: string;
    nextHref: string;
}) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");

    const handleSubmit = async () => {
        setIsSaving(true);

        try {
            const result = await createLocation({
                name,
                address,
                timezone,
            });

            if (result?.error) {
                toast.error(result.error);
                return;
            }

            toast.success("First location saved.");
            if (result?.warning) {
                toast.warning(result.warning);
            }
            router.push(nextHref);
            router.refresh();
        } catch {
            toast.error("Failed to save location.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    <CardTitle>First location</CardTitle>
                </div>
                <CardDescription>
                    Add the first place where schedules are published and workers clock in. Keep this step minimal: a clear location name and a real street address.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="onboarding_location_name">Location name</FieldLabel>
                        <Input
                            id="onboarding_location_name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Downtown Store"
                        />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="onboarding_location_address">Street address</FieldLabel>
                        <Input
                            id="onboarding_location_address"
                            value={address}
                            onChange={(event) => setAddress(event.target.value)}
                            placeholder="123 Main St, Boston, MA 02116"
                        />
                        <FieldDescription>
                            We&apos;ll verify this address now and use your business timezone of{" "}
                            <span className="font-medium text-foreground">{timezone}</span>.
                        </FieldDescription>
                    </Field>
                </FieldGroup>
            </CardContent>
            <CardFooter className="justify-between gap-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/dashboard/onboarding")}
                >
                    Back
                </Button>
                <Button
                    type="button"
                    size="lg"
                    disabled={isSaving || !name.trim() || !address.trim()}
                    onClick={() => {
                        void handleSubmit();
                    }}
                >
                    {isSaving ? <Spinner data-icon="inline-start" /> : null}
                    Save location and continue
                </Button>
            </CardFooter>
        </Card>
    );
}
