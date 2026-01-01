import { useState } from "react";
import { Check, User, Plus, Phone } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@repo/ui/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { ContactOption } from "@/hooks/use-schedule-data";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Checkbox } from "@repo/ui/components/ui/checkbox";

interface ContactPickerProps {
    contacts: ContactOption[];
    value: string[];
    onValueChange: (value: string[]) => void;
}

export function ContactPicker({ contacts, value = [], onValueChange }: ContactPickerProps) {
    const [open, setOpen] = useState(false);

    // Derived state for display
    const selectedContacts = contacts.filter((c) => value.includes(c.id));
    const label = selectedContacts.length > 0
        ? selectedContacts.map(c => c.name).join(", ")
        : "Select onsite managers";

    const handleToggle = (id: string) => {
        if (value.includes(id)) {
            onValueChange(value.filter(v => v !== id));
        } else {
            onValueChange([...value, id]);
        }
    };

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Onsite Managers
            </label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between h-auto py-3 text-left font-normal",
                            value.length === 0 && "text-muted-foreground"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            {selectedContacts.length > 0 ? (
                                <div className="flex -space-x-2">
                                    {selectedContacts.slice(0, 3).map((c) => (
                                        <Avatar key={c.id} className="h-6 w-6 border-2 border-background">
                                            <AvatarFallback className="text-[10px]">{c.initials}</AvatarFallback>
                                        </Avatar>
                                    ))}
                                    {selectedContacts.length > 3 && (
                                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] border-2 border-background">
                                            +{selectedContacts.length - 3}
                                        </div>
                                    )}
                                </div>
                            ) : null}
                            <span>{label}</span>
                        </div>
                        <User className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search team member..." />
                        <CommandList>
                            <CommandEmpty>No contact found.</CommandEmpty>
                            <CommandGroup>
                                {contacts.map((contact) => {
                                    const isSelected = value.includes(contact.id);
                                    return (
                                        <CommandItem
                                            key={contact.id}
                                            value={contact.name}
                                            onSelect={() => handleToggle(contact.id)}
                                            className="cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3 w-full">
                                                <div className={cn(
                                                    "flex items-center justify-center h-4 w-4 rounded-sm border border-primary",
                                                    isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                )}>
                                                    <Check className={cn("h-3 w-3")} />
                                                </div>

                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback>{contact.initials}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col gap-0.5 flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium">{contact.name}</span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Phone className="h-3 w-3" />
                                                        {contact.phone}
                                                    </span>
                                                </div>
                                            </div>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
