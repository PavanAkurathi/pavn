"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
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
    const [isHydrated, setIsHydrated] = useState(false);
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");

    useEffect(() => {
        setIsHydrated(true);
    }, []);

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
        <Card className="border-slate-200 shadow-sm">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    <CardTitle>First location</CardTitle>
                </div>
                <CardDescription>
                    Add the first place where schedules are published and workers clock in. Keep this step minimal: a clear location name and a real street address. You can refine geofence details later if needed.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="onboarding_location_name">Location name</FieldLabel>
                            <Input
                                id="onboarding_location_name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder="Downtown Store"
                                className="bg-white"
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="onboarding_location_address">Street address</FieldLabel>
                            <Input
                                id="onboarding_location_address"
                                value={address}
                                onChange={(event) => setAddress(event.target.value)}
                                placeholder="123 Main St, Boston, MA 02116"
                                className="bg-white"
                            />
                            <p className="text-sm text-muted-foreground">
                                We will try to verify this address now and use your business timezone of <span className="font-medium text-slate-700">{timezone}</span>.
                            </p>
                        </Field>
                    </FieldGroup>

                    <div className="flex flex-wrap gap-3">
                        <Button
                            type="button"
                            size="lg"
                            className="gap-2 rounded-full px-8"
                            disabled={isSaving || !isHydrated || !name.trim() || !address.trim()}
                            onClick={() => {
                                void handleSubmit();
                            }}
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Save location and continue
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            className="rounded-full px-8"
                            disabled={isSaving}
                            onClick={() => router.push("/settings/locations")}
                        >
                            Open full location settings
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
