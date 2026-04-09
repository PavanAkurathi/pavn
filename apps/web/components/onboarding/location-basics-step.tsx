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
} from "@repo/ui/components/ui/card";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { PlaceAutocompleteInput } from "@/components/locations/place-autocomplete-input";
import { createLocation } from "@/actions/locations";

export function LocationBasicsStep({
    timezone,
    backHref,
    nextHref,
}: {
    timezone: string;
    backHref: string;
    nextHref: string;
}) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [autocompleteConfirmed, setAutocompleteConfirmed] = useState(false);

    const handlePlaceSelect = (place: google.maps.places.PlaceResult) => {
        const formattedAddress = place.formatted_address || "";
        setAddress(formattedAddress);
        setAutocompleteConfirmed(Boolean(formattedAddress));

        if (!name.trim() && place.name && place.name !== formattedAddress) {
            setName(place.name);
        }
    };

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
        <Card className="rounded-[28px] border-border/70 shadow-lg shadow-black/5">
            <CardContent className="pt-6">
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
                        <PlaceAutocompleteInput
                            id="onboarding_location_address"
                            value={address}
                            onChange={(value) => {
                                setAddress(value);
                                setAutocompleteConfirmed(false);
                            }}
                            onAddressSelect={handlePlaceSelect}
                            placeholder="Search for your business address"
                        />
                        <FieldDescription>
                            {autocompleteConfirmed
                                ? "Address selected from Google Maps. We’ll use it for schedules and clock-in verification."
                                : <>Use Google Maps autocomplete for the cleanest address match. Your business timezone stays <span className="font-medium text-foreground">{timezone}</span>.</>}
                        </FieldDescription>
                    </Field>
                </FieldGroup>
            </CardContent>
            <CardFooter className="justify-between gap-3 border-t border-border/60 pt-6">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(backHref)}
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
