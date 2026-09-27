"use client";

import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { cn } from "@repo/ui/lib/utils";

export interface Choice<T extends string> {
    value: T;
    label: string;
    summary: string;
}

/**
 * A radio group drawn as tappable cards: the whole card selects, the summary
 * says what the choice changes.
 */
export function ChoiceCards<T extends string>({
    name,
    value,
    choices,
    onChange,
    disabled,
    columns = 2,
    "aria-labelledby": labelledBy,
}: {
    name: string;
    value: T | null;
    choices: Choice<T>[];
    onChange: (value: T) => void;
    disabled?: boolean;
    columns?: 1 | 2;
    "aria-labelledby"?: string;
}) {
    return (
        <RadioGroup
            value={value ?? ""}
            onValueChange={(next) => onChange(next as T)}
            disabled={disabled}
            aria-labelledby={labelledBy}
            className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")}
        >
            {choices.map((choice) => {
                const id = `${name}-${choice.value}`;
                const selected = choice.value === value;
                return (
                    <label
                        key={choice.value}
                        htmlFor={id}
                        className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 p-4 transition-colors",
                            "hover:bg-accent/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                            selected && "border-primary bg-primary/5",
                            disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
                        )}
                    >
                        <RadioGroupItem id={id} value={choice.value} className="mt-0.5 shrink-0" />
                        <span className="flex min-w-0 flex-col gap-1">
                            <span className="text-sm font-medium leading-5 text-foreground">{choice.label}</span>
                            <span className="text-sm leading-5 text-muted-foreground">{choice.summary}</span>
                        </span>
                    </label>
                );
            })}
        </RadioGroup>
    );
}
