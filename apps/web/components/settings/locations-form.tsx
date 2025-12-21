"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import {
    Field,
    FieldGroup,
    FieldLabel,
} from "@repo/ui/components/ui/field";
import { toast } from "sonner";
import { Loader2, Plus, MapPin, Trash2 } from "lucide-react";

import { createLocation, deleteLocation } from "../../app/(protected)/settings/actions";

type Location = {
    id: string;
    name: string;
    address: string | null;
    storeId?: string; // Not in schema yet, ignore for now or map to slug
};

interface LocationsFormProps {
    locations: Location[];
}

export function LocationsForm({ locations }: LocationsFormProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [storeId, setStoreId] = useState("");

    const handleAddLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const result = await createLocation({
                name,
                address,
                timezone: "UTC" // Default for now
            });

            if (result.error) {
                toast.error(result.error);
                return;
            }

            toast.success("Location added successfully!");
            setIsAdding(false);
            // Reset form
            setName("");
            setAddress("");
            setStoreId("");
        } catch (error) {
            toast.error("Failed to add location.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const result = await deleteLocation(id);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success("Location removed.");
        } catch (error) {
            toast.error("Failed to remove location.");
        }
    };

    if (isAdding) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Add New Location</CardTitle>
                    <CardDescription>Enter the details for the new business location.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddLocation} className="space-y-6">
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="loc_name">Location Name</FieldLabel>
                                <Input
                                    id="loc_name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Downtown Branch"
                                    required
                                    className="bg-white"
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="address">Address</FieldLabel>
                                <Input
                                    id="address"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="123 Street Name, City, State"
                                    required
                                    className="bg-white"
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="store_id">Store ID (Optional)</FieldLabel>
                                <Input
                                    id="store_id"
                                    value={storeId}
                                    onChange={(e) => setStoreId(e.target.value)}
                                    placeholder="e.g. STR-002"
                                    className="bg-white"
                                />
                            </Field>
                        </FieldGroup>
                        <div className="flex justify-end gap-3">
                            <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Add Location
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                <div className="space-y-1.5">
                    <CardTitle>Locations</CardTitle>
                    <CardDescription>Manage your business locations.</CardDescription>
                </div>
                <Button onClick={() => setIsAdding(true)} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Location
                </Button>
            </CardHeader>
            <CardContent>
                {locations.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                        No locations found. Add one to get started.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {locations.map((loc) => (
                            <div key={loc.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 bg-slate-100 p-2 rounded-full text-slate-600">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">{loc.name}</p>
                                        <p className="text-sm text-slate-500">{loc.address}</p>
                                        {loc.storeId && (
                                            <p className="text-xs text-slate-400 mt-1 font-mono">ID: {loc.storeId}</p>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => handleDelete(loc.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span className="sr-only">Delete</span>
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
