"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@repo/ui/components/ui/input";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function PlaceAutocompleteField({
    id,
    value,
    placeholder,
    onChange,
    onAddressSelect,
}: {
    id?: string;
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
    onAddressSelect: (place: google.maps.places.PlaceResult) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const places = useMapsLibrary("places");
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

    useEffect(() => {
        if (!places || !inputRef.current) return;

        setAutocomplete(
            new places.Autocomplete(inputRef.current, {
                fields: ["formatted_address", "name", "geometry", "address_components"],
            }),
        );
    }, [places]);

    useEffect(() => {
        if (!autocomplete) return;

        const listener = autocomplete.addListener("place_changed", () => {
            onAddressSelect(autocomplete.getPlace());
        });

        return () => {
            google.maps.event.removeListener(listener);
        };
    }, [autocomplete, onAddressSelect]);

    return (
        <Input
            ref={inputRef}
            id={id}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
        />
    );
}

export function PlaceAutocompleteInput({
    id,
    value,
    placeholder = "Search for an address",
    onChange,
    onAddressSelect,
}: {
    id?: string;
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
    onAddressSelect: (place: google.maps.places.PlaceResult) => void;
}) {
    if (!GOOGLE_MAPS_API_KEY) {
        return (
            <Input
                id={id}
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
            />
        );
    }

    return (
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
            <PlaceAutocompleteField
                id={id}
                value={value}
                placeholder={placeholder}
                onChange={onChange}
                onAddressSelect={onAddressSelect}
            />
        </APIProvider>
    );
}
