// app/components/schedule/contact-picker.tsx

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

interface ContactPickerProps {
    contacts: ContactOption[];
    value: string;
    onValueChange: (value: string) => void;
}

export function ContactPicker({ contacts, value, onValueChange }: ContactPickerProps) {
    const [open, setOpen] = useState(false);
    const selectedContact = contacts.find((c) => c.id === value);

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Onsite Contact
            </label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between h-auto py-3 text-left font-normal",
                            !value && "text-muted-foreground"
                        )}
                    >
                        {selectedContact ? (
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback>{selectedContact.initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-medium text-foreground leading-none">{selectedContact.name}</span>
                                    <span className="text-xs text-muted-foreground leading-none">{selectedContact.phone}</span>
                                </div>
                            </div>
                        ) : (
                            "Select onsite contact"
                        )}
                        <User className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search team member..." />
                        <CommandList>
                            <CommandEmpty>No contact found.</CommandEmpty>
                            <CommandGroup>
                                {contacts.map((contact) => (
                                    <CommandItem
                                        key={contact.id}
                                        value={contact.name}
                                        onSelect={() => {
                                            onValueChange(contact.id === value ? "" : contact.id);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3 w-full">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback>{contact.initials}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col gap-0.5 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">{contact.name}</span>
                                                    {value === contact.id && <Check className="h-4 w-4 text-primary" />}
                                                </div>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    {contact.phone}
                                                </span>
                                            </div>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
