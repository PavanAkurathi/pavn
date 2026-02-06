// apps/web/components/availability/set-availability-form.tsx
"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Calendar } from "@repo/ui/components/ui/calendar"; // Assuming standard UI presence
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { API_BASE_URL } from "@/lib/constants";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@repo/ui/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/ui/select";
import { Input } from "@repo/ui/components/ui/input";

// Schema matching the Controller
const formSchema = z.object({
    date: z.date(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Required"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Required"),
    type: z.enum(["unavailable", "preferred"]),
});

export function SetAvailabilityForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            type: "unavailable",
            startTime: "09:00",
            endTime: "17:00",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        setMessage(null);

        // Combine Date + Time -> ISO String
        const dateStr = format(values.date, "yyyy-MM-dd");
        const startIso = `${dateStr}T${values.startTime}:00`;
        const endIso = `${dateStr}T${values.endTime}:00`;

        // Adjust for timezone? Input is local, ISO is ... local? 
        // The controller expects ISO strings.
        // We will send FULL ISO strings with timezone offset roughly 
        // OR better: Just new Date(startIso).toISOString() which converts to UTC.

        const startUtc = new Date(startIso).toISOString();
        const endUtc = new Date(endIso).toISOString();



        // ... (keep previous lines) ... 

        try {
            // Direct call to Hono Service (Port 4005)
            // TODO: Use env var for URL
            const res = await fetch(`${API_BASE_URL}/worker/availability`, {
                method: "POST",
                credentials: "include", // Ensure session cookies are sent
                headers: {
                    "Content-Type": "application/json",
                    // Pass current Org ID if needed, though this is user-scoped
                    // Auth headers are handled by browser cookies usually, or we explicitly attach from session if needed
                },
                body: JSON.stringify({
                    startTime: startUtc,
                    endTime: endUtc,
                    type: values.type
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to set availability");
            }

            setMessage({ type: 'success', text: "Availability set successfully!" });
            form.reset({ ...values, type: "unavailable" });

        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <h3 className="font-semibold leading-none tracking-tight mb-4">Set Availability</h3>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                    <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>I am...</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="unavailable">Unavailable (Block)</SelectItem>
                                        <SelectItem value="preferred">Preferred (Request)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Date</FormLabel>
                                <Input
                                    type="date"
                                    value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="startTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Start Time</FormLabel>
                                    <FormControl>
                                        <Input type="time" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="endTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>End Time</FormLabel>
                                    <FormControl>
                                        <Input type="time" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {message && (
                        <div className={`text-sm p-2 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {message.text}
                        </div>
                    )}

                    <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Availability
                    </Button>
                </form>
            </Form>
        </div>
    );
}
