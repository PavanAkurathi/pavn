// apps/web/components/schedule/location-picker.tsx

import { useState } from "react";
import { Check, MapPin, Plus } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@repo/ui/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { Location } from "@/lib/types";

interface LocationPickerProps {
    locations: Location[];
    value: string;
    onValueChange: (value: string) => void;
    onAddLocation?: () => void;
}

export function LocationPicker({ locations, value, onValueChange, onAddLocation }: LocationPickerProps) {
    const [open, setOpen] = useState(false);
    const selectedLocation = locations.find((loc) => loc.id === value);

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Work Location
            </label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between h-auto min-h-16 py-3 text-left font-normal",
                            !value && "text-muted-foreground"
                        )}
                    >
                        {selectedLocation ? (
                            <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-foreground">{selectedLocation.name}</span>
                                <span className="text-xs text-muted-foreground truncate">{selectedLocation.address}</span>
                            </div>
                        ) : (
                            "Select work location"
                        )}
                        <MapPin className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search location..." />
                        <CommandList>
                            <CommandEmpty>No location found.</CommandEmpty>
                            <CommandGroup>
                                {locations.map((location) => (
                                    <CommandItem
                                        key={location.id}
                                        value={location.name} // Search by name
                                        onSelect={() => {
                                            onValueChange(location.id === value ? "" : location.id);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <div className="flex flex-col gap-0.5 w-full">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">{location.name}</span>
                                                {value === location.id && <Check className="h-4 w-4 text-primary" />}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{location.address}</span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                                <CommandItem
                                    onSelect={() => {
                                        onAddLocation?.();
                                        setOpen(false);
                                    }}
                                    className="cursor-pointer text-primary"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add new work location
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
