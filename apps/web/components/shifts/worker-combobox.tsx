'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, User } from 'lucide-react';
import { cn } from '@repo/ui/lib/utils';
import { Button } from '@repo/ui/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@repo/ui/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@repo/ui/components/ui/command';

interface Worker {
    id: string;
    name: string;
    initials: string;
}

interface WorkerComboboxProps {
    workers: Worker[];
    value: string | null;
    onChange: (value: string | null) => void;
}

export function WorkerCombobox({ workers, value, onChange }: WorkerComboboxProps) {
    const [open, setOpen] = React.useState(false);

    const selectedWorker = value ? workers.find(w => w.id === value) : null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[200px] justify-between bg-background border-border"
                >
                    <div className="flex items-center">
                        <User className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">
                            {selectedWorker?.name ?? "All Workers"}
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search worker..." />
                    <CommandList>
                        <CommandEmpty>No worker found.</CommandEmpty>
                        <CommandGroup>
                            {/* All Workers option */}
                            <CommandItem
                                value="all-workers"
                                onSelect={() => {
                                    onChange(null);
                                    setOpen(false);
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === null ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                All Workers
                            </CommandItem>
                            {workers.map((worker) => (
                                <CommandItem
                                    key={worker.id}
                                    value={worker.name}
                                    onSelect={() => {
                                        onChange(worker.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === worker.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {worker.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
