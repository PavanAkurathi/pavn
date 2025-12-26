'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ChevronDown, Info } from "lucide-react";
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/ui/avatar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@repo/ui/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/ui/select";

/* -------------------------------------------------------------------------- */
/*                                1. PROFILE CELL                             */
/* -------------------------------------------------------------------------- */
interface ProfileProps {
    id: string;
    name: string;
    initials: string;
    url?: string;
    role: string;
    rate: number;
}

export function ProfileCell({ id, name, initials, url, role, rate }: ProfileProps) {
    return (
        <div className="flex items-center gap-3 py-1">
            {/* Avatar */}
            <Link href={`/dashboard/workers/${id}`} className="relative shrink-0">
                <Avatar className="h-10 w-10 border border-border transition-transform hover:scale-105">
                    <AvatarImage src={url} />
                    <AvatarFallback className="bg-secondary text-[10px] font-bold text-muted-foreground">
                        {initials}
                    </AvatarFallback>
                </Avatar>
            </Link>

            {/* Name & Role */}
            <div className="flex flex-col min-w-0">
                <Link
                    href={`/dashboard/workers/${id}`}
                    className="truncate text-sm font-bold text-foreground hover:underline hover:text-primary"
                >
                    {name}
                </Link>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate font-medium">{role}</span>
                    <span className="text-border">•</span>
                    <span>${rate.toFixed(2)}/hr</span>
                </div>
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*                                2. CLOCK CELL                               */
/* -------------------------------------------------------------------------- */
interface ClockCellProps {
    value: string;
    label: string;
    onSave: (val: string) => void;
}

export function ClockCell({ value, label, onSave }: ClockCellProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [tempValue, setTempValue] = useState('');

    let display = '-- : --';
    if (value) {
        try { display = format(new Date(value), 'hh : mm aa'); } catch { }
    }

    const handleOpen = () => {
        setTempValue(value ? format(new Date(value), 'HH:mm') : '');
        setIsOpen(true);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    onClick={handleOpen}
                    className="flex h-9 w-full min-w-[100px] items-center justify-center rounded-md border border-border bg-secondary/50 px-2 text-xs font-medium text-foreground transition-all hover:border-accent hover:bg-background focus:ring-2 focus:ring-accent/20"
                >
                    {display}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3">
                <div className="space-y-3">
                    <h4 className="text-xs font-medium text-muted-foreground">{label}</h4>
                    <div className="flex gap-2">
                        <Input
                            type="time"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="h-8 text-xs"
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button size="sm" className="h-7 w-full text-xs" onClick={() => { onSave(tempValue); setIsOpen(false); }}>
                            Set Time
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

/* -------------------------------------------------------------------------- */
/*                                3. BREAK CELL                               */
/* -------------------------------------------------------------------------- */
interface BreakCellProps {
    value: number;
    onChange: (val: number) => void;
}

export function BreakCell({ value, onChange }: BreakCellProps) {
    const options = [0, 15, 30, 45, 60, 90];

    return (
        <Select
            value={value.toString()}
            onValueChange={(val) => onChange(Number(val))}
        >
            <SelectTrigger className="h-9 w-full min-w-[90px] border-border bg-secondary/50 text-xs font-medium text-foreground hover:border-accent hover:bg-background focus:ring-0">
                <SelectValue placeholder="0 min" />
            </SelectTrigger>
            <SelectContent>
                {options.map((opt) => (
                    <SelectItem key={opt} value={opt.toString()} className="text-xs">
                        {opt} min
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/* -------------------------------------------------------------------------- */
/*                                4. ROSTER CELL                              */
/* -------------------------------------------------------------------------- */
interface RosterCellProps {
    status: 'rostered' | 'new' | 'blocked';
    name: string;
}

export function RosterCell({ status, name }: RosterCellProps) {
    if (status === 'rostered') {
        return (
            <div className="flex h-9 items-center justify-between rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span>Rostered</span>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground opacity-50" />
            </div>
        );
    }

    return (
        <div className="flex items-center h-9 w-full">
            <div className="grid w-full grid-cols-3 gap-2 h-full">

                {/* ADD: Accent (Orange) - Adjust 'border-accent' if accent color isn't defined or map to primary */}
                <Button
                    variant="outline"
                    className="h-full w-full border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-colors p-0 text-[10px] font-bold uppercase tracking-wide rounded-md"
                >
                    Add
                </Button>

                {/* RETURN: Neutral */}
                <Button
                    variant="outline"
                    className="h-full w-full border-border text-muted-foreground hover:bg-secondary hover:text-foreground p-0 text-[10px] font-medium rounded-md"
                >
                    Return
                </Button>

                {/* BLOCK: Destructive */}
                <Button
                    variant="outline"
                    className="h-full w-full border-border text-muted-foreground hover:border-destructive hover:bg-destructive hover:text-destructive-foreground p-0 text-[10px] font-medium rounded-md"
                >
                    Block
                </Button>
            </div>
        </div>
    );
}
