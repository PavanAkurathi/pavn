// apps/web/components/schedule/create-schedule-form.tsx

"use client";

import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@repo/ui/components/ui/form";
import { useLocations, useContacts } from "@/hooks/use-schedule-data";
import { LocationPicker } from "./location-picker";
import { ContactPicker } from "./contact-picker";
import { ScheduleBlock } from "./schedule-block";

// Schema Definitions
const PositionSchema = z.object({
    id: z.string().optional(), // Used for field array key usually auto-generated but good to have
    roleId: z.string(),
    roleName: z.string(),
    workerId: z.string().nullable(),
    workerName: z.string().optional(),
    workerAvatar: z.string().optional(),
    workerInitials: z.string().optional(),
});

const ScheduleBlockSchema = z.object({
    scheduleName: z.string().min(1, "Schedule name is required"),
    date: z.date({ message: "A date is required." }),
    startTime: z.string().min(1, "Required"),
    endTime: z.string().min(1, "Required"),
    breakDuration: z.string(),
    positions: z.array(PositionSchema),
});

const formSchema = z.object({
    locationId: z.string().min(1, "Please select a location"),
    contactId: z.string().min(1, "Please select a contact"),
    schedules: z.array(ScheduleBlockSchema).min(1, "At least one schedule is required"),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_SCHEDULE_BLOCK = {
    scheduleName: "",
    breakDuration: "0",
    startTime: "",
    endTime: "",
    positions: [],
};

export function CreateScheduleForm() {
    // 1. Data Hooks
    const { data: locations } = useLocations();
    const { data: contacts } = useContacts();

    const currentUserId = "user_2qXN4k7y8Z5m3P9r1";

    // 2. Form Setup
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            locationId: "",
            contactId: "",
            schedules: [{ ...DEFAULT_SCHEDULE_BLOCK, date: undefined } as any],
        },
    });

    const { fields, append, remove, insert } = useFieldArray({
        control: form.control,
        name: "schedules",
    });

    // 3. Auto-select current user as contact
    useEffect(() => {
        if (contacts && currentUserId && !form.getValues("contactId")) {
            const me = contacts.find(c => c.userId === currentUserId);
            if (me) {
                form.setValue("contactId", me.id);
            }
        }
    }, [contacts, currentUserId, form]);

    const handleDuplicate = (index: number) => {
        const currentData = form.getValues(`schedules.${index}`);
        // Deep copy logic handled by getValues + insert
        insert(index + 1, {
            ...currentData,
            // Keep date or clear it? Requirement says: "Keep the dates".
        });
    };

    return (
        <Form {...form}>
            <div className="space-y-6">
                {/* Global Settings: Location & Contact */}
                <Card>
                    <CardContent className="pt-6 space-y-6">
                        <FormField
                            control={form.control}
                            name="locationId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <LocationPicker
                                            locations={locations}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="contactId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <ContactPicker
                                            contacts={contacts}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Dynamic Schedule List */}
                {fields.map((field, index) => (
                    <ScheduleBlock
                        key={field.id}
                        index={index}
                        onRemove={() => remove(index)}
                        onDuplicate={() => handleDuplicate(index)}
                        canDelete={fields.length > 1}
                    />
                ))}

                {/* Add Schedule Button */}
                <Button
                    type="button"
                    variant="outline"
                    className="w-full h-14 border-dashed border-2 text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                    onClick={async () => {
                        const lastIndex = fields.length - 1;
                        if (lastIndex >= 0) {
                            const isValid = await form.trigger(`schedules.${lastIndex}`);
                            if (isValid) {
                                append({ ...DEFAULT_SCHEDULE_BLOCK, date: undefined } as any);
                            }
                        } else {
                            // Should be rare since we init with 1, but safe fallback
                            append({ ...DEFAULT_SCHEDULE_BLOCK, date: undefined } as any);
                        }
                    }}
                >
                    <Plus className="mr-2 h-5 w-5" />
                    Add another schedule
                </Button>
            </div>
        </Form>
    );
}
