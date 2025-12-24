"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Badge } from "@repo/ui/components/ui/badge";
import { Bold, Italic, Link as LinkIcon, Paperclip } from "lucide-react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";

interface AddLocationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: {
        name: string;
        address: string;
        zip: string;
        parking: string;
        specifics: string[];
        instructions?: string
    }) => Promise<{ error?: string }>;
    initialData?: {
        name: string;
        address: string;
        zip?: string;
        parking?: string;
        specifics?: string[];
        instructions?: string
    } | null;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function PlaceAutocomplete({ value, onChange, onAddressSelect }: {
    value: string,
    onChange: (val: string) => void,
    onAddressSelect: (place: google.maps.places.PlaceResult) => void
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const places = useMapsLibrary("places");
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

    useEffect(() => {
        if (!places || !inputRef.current) return;

        const options = {
            fields: ["formatted_address", "name", "geometry", "address_components"],
        };

        setAutocomplete(new places.Autocomplete(inputRef.current, options));
    }, [places]);

    useEffect(() => {
        if (!autocomplete) return;

        const listener = autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            onAddressSelect(place);
        });

        return () => {
            google.maps.event.removeListener(listener);
        };
    }, [autocomplete, onAddressSelect]);

    return (
        <Input
            ref={inputRef}
            placeholder="Search for an address"
            className="h-11"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

export function AddLocationModal({ open, onOpenChange, onSave, initialData }: AddLocationModalProps) {
    const [parking, setParking] = useState<string>("free");
    const [specifics, setSpecifics] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [address, setAddress] = useState("");
    const [zip, setZip] = useState("");
    const [name, setName] = useState("");
    const [instructions, setInstructions] = useState("");

    // Populate or Reset Form
    useEffect(() => {
        if (open) {
            if (initialData) {
                setName(initialData.name);
                setAddress(initialData.address);
                setZip(initialData.zip || "");
                setParking(initialData.parking || "free");
                setSpecifics(initialData.specifics || []);
                setInstructions(initialData.instructions || "");
            } else {
                setName("");
                setAddress("");
                setZip("");
                setParking("free");
                setSpecifics([]);
                setInstructions("");
            }
        }
    }, [open, initialData]);

    // Handle Google Place Select
    const handlePlaceSelect = (place: google.maps.places.PlaceResult) => {
        setAddress(place.formatted_address || "");
        setName(place.name || "");

        // Extract Zip Code
        const zipComponent = place.address_components?.find(c => c.types.includes("postal_code"));
        if (zipComponent) {
            setZip(zipComponent.long_name);
        }
    };

    const toggleSpecific = (val: string) => {
        setSpecifics(prev =>
            prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]
        );
    };

    const handleSave = async () => {
        if (!name) return; // Simple validation
        setLoading(true);
        try {
            const res = await onSave({
                name,
                address,
                zip,
                parking,
                specifics,
                instructions
            });
            if (!res?.error) {
                onOpenChange(false);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-4 mb-4">
                    <DialogTitle className="text-xl font-bold">
                        {initialData ? "Edit Location" : "Add street address"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-8 py-2">
                    {/* ... Inputs ... (Keep existing inputs) */}
                    {/* Row 1: Address & Zip */}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6">
                        <div className="space-y-2">
                            <Label className="font-semibold text-slate-900">Street address<span className="text-red-500">*</span></Label>
                            {API_KEY ? (
                                <APIProvider apiKey={API_KEY}>
                                    <PlaceAutocomplete
                                        value={address}
                                        onChange={setAddress}
                                        onAddressSelect={handlePlaceSelect}
                                    />
                                </APIProvider>
                            ) : (
                                <Input
                                    placeholder="Address"
                                    className="h-11"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                />
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label className="font-semibold text-slate-900">Zipcode<span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="Zip code"
                                className="h-11"
                                value={zip}
                                onChange={(e) => setZip(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Work Location Name */}
                    <div className="space-y-2">
                        <Label className="font-semibold text-slate-900">Work location name<span className="text-red-500">*</span></Label>
                        <Input
                            placeholder="Location Name"
                            className="h-11"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    {/* ... Parking, Specifics, etc ... */}
                    {/* Parking */}
                    <div className="space-y-3">
                        <Label className="font-semibold text-slate-900">Parking<span className="text-red-500">*</span></Label>
                        <div className="flex flex-wrap gap-3">
                            {["Free parking", "Paid parking", "No parking"].map((opt) => {
                                const val = opt.toLowerCase().split(' ')[0] || "free";
                                const isActive = parking === val || (val === "no" && parking === "no");

                                return (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setParking(val)}
                                        className={`px-6 py-2 rounded-full border text-sm font-medium transition-colors ${isActive
                                            ? "bg-slate-900 text-white border-slate-900"
                                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                            }`}
                                    >
                                        {opt}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Specifics */}
                    <div className="space-y-3">
                        <Label className="font-semibold text-slate-900">Specifics</Label>
                        <div className="flex flex-wrap gap-3">
                            {[
                                { label: "Use back door", id: "backdoor" },
                                { label: "Has free meals", id: "meals" }
                            ].map((item) => {
                                const isActive = specifics.includes(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => toggleSpecific(item.id)}
                                        className={`px-6 py-2 rounded-full border text-sm font-medium transition-colors ${isActive
                                            ? "bg-slate-900 text-white border-slate-900"
                                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                            }`}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Instructions (Mock Rich Text) */}
                    <div className="space-y-3">
                        <Label className="font-semibold text-slate-900">Instructions</Label>
                        <div className="text-sm text-muted-foreground mb-2">
                            Add details to help workers locate and prepare for your work location.
                        </div>
                        <div className="border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:border-primary">
                            {/* Toolbar */}
                            <div className="flex items-center gap-4 px-4 py-2 border-b bg-slate-50/50">
                                <button type="button" className="text-slate-500 hover:text-slate-900"><Bold className="w-4 h-4" /></button>
                                <button type="button" className="text-slate-500 hover:text-slate-900"><Italic className="w-4 h-4" /></button>
                                <div className="w-px h-4 bg-slate-200" />
                                <button type="button" className="text-primary font-medium text-sm flex items-center gap-1 hover:underline">
                                    <LinkIcon className="w-3 h-3" /> Add link
                                </button>
                            </div>
                            {/* Editor Area */}
                            <textarea
                                className="w-full h-32 p-4 resize-none outline-none text-sm"
                                placeholder="• Ex: Clock in on time..."
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* PDF Files */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Label className="font-semibold text-slate-900">PDF Files</Label>
                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] px-1.5 h-5">NEW</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                            Please upload files for Pros review detailing arrival information...
                        </div>

                        <div className="border-2 border-dashed border-input rounded-lg p-8 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-100 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-2 text-primary group-hover:text-primary/90">
                                <Paperclip className="w-4 h-4" />
                                <span className="font-medium">Drag & drop, or click to select files</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Add one or more supporting documents (only PDFs up to 10mb each.)</p>
                    </div>

                </div>

                <DialogFooter className="pt-4 border-t">
                    <Button className="w-[124px] rounded-lg" onClick={handleSave} disabled={loading || !name}>
                        {loading ? "Saving..." : "Save Location"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    );
}
