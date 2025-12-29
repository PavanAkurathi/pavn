// apps/web/components/schedule/create-schedule-form.tsx

"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@repo/ui/components/ui/form";
import { useLocations, useContacts, useOrganizationId } from "@/hooks/use-schedule-data";
import { useCrewData } from "@/hooks/use-crew-data";
import { LocationPicker } from "./location-picker";
import { ContactPicker } from "./contact-picker";
import { ScheduleBlock } from "./schedule-block";
import { ReviewScheduleDialog } from "./review-schedule-dialog";
import { shiftService } from "@repo/shifts-service";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExitDialog } from "./exit-dialog";

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
    managerIds: z.array(z.string()).min(1, "Please select at least one manager"),
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
    // 1. Hook Definitions
    const { data: locations } = useLocations();
    const { data: contacts } = useContacts();
    const activeOrganizationId = useOrganizationId();
    const { roles, crew } = useCrewData();
    const currentUserId = "user_2qXN4k7y8Z5m3P9r1";
    const router = useRouter();
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);

    // 2. Form Setup
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            locationId: "",
            managerIds: [],
            schedules: [{ ...DEFAULT_SCHEDULE_BLOCK, date: undefined } as any],
        },
    });

    const { fields, append, remove, insert } = useFieldArray({
        control: form.control,
        name: "schedules",
    });

    // 3. Auto-select current user as contact
    // 3. Auto-select current user as contact
    useEffect(() => {
        if (contacts && currentUserId) {
            const currentManagers = form.getValues("managerIds");
            if (currentManagers.length === 0) {
                const me = contacts.find(c => c.userId === currentUserId);
                if (me) {
                    form.setValue("managerIds", [me.id]);
                }
            }
        }
    }, [contacts, currentUserId, form]);

    const handleDuplicateSchedule = (index: number) => {
        const currentData = form.getValues(`schedules.${index}`);
        // Deep copy logic handled by getValues + insert
        insert(index + 1, {
            ...currentData,
            // Keep date or clear it? Requirement says: "Keep the dates".
        });
    };

    const handleRemoveSchedule = (index: number) => {
        remove(index);
    };

    const handleReview = async () => {
        const isValid = await form.trigger();
        if (isValid) {
            setIsReviewOpen(true);
        } else {
            toast.error("Please fix validation errors before publishing.");
        }
    };

    const handlePublish = async () => {
        setIsSubmitting(true);
        try {
            const data = form.getValues();

            // 1. Get Client Timezone
            const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            // 2. Get Real Org ID
            if (!activeOrganizationId) {
                toast.error("Organization ID missing. Please log in again.");
                return;
            }

            const payload = {
                locationId: data.locationId,
                organizationId: activeOrganizationId,
                contactId: data.managerIds[0],
                timezone: clientTimezone,
                schedules: data.schedules.map(s => ({
                    startTime: s.startTime,
                    endTime: s.endTime,
                    dates: [format(s.date, "yyyy-MM-dd")],
                    scheduleName: s.scheduleName,
                    positions: s.positions.map(p => ({
                        roleName: p.roleName,
                        workerIds: [p.workerId || null]
                    }))
                }))
            };

            await shiftService.publishSchedule(payload);
            toast.success("Schedule published successfully!");
            router.push("/dashboard/shifts");
        } catch (error) {
            console.error("Publish error:", error);
            toast.error("Failed to publish schedule.");
        } finally {
            setIsSubmitting(false);
            setIsReviewOpen(false);
        }
    };

    const handleExit = () => {
        // Check if form is dirty? For now, always ask if they intend to exit via the X button
        setIsExitDialogOpen(true);
    };

    const handleSaveDraft = () => {
        const data = form.getValues();
        localStorage.setItem("schedule-layout-draft", JSON.stringify(data));
        toast.success("Draft saved successfully");
        router.push("/dashboard/shifts");
    };

    const handleDiscard = () => {
        localStorage.removeItem("schedule-layout-draft");
        router.push("/dashboard/shifts");
    };

    // Load draft checks? (Optional enhancement: Load on mount)
    // For now, focusing on the Save/Exit flow as requested.

    return (
        <div className="relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Create Schedule</h1>
                    <p className="text-muted-foreground">
                        Set up a new shift schedule for your team and location.
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleExit} className="h-10 w-10 rounded-full">
                    <X className="h-6 w-6" />
                </Button>
            </div>

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
                                name="managerIds"
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
                    {fields.map((field, index) => <ScheduleBlock
                        key={field.id}
                        index={index}
                        onRemove={() => handleRemoveSchedule(index)}
                        onDuplicate={() => handleDuplicateSchedule(index)}
                        canDelete={fields.length > 1}
                        roles={roles}
                        crew={crew}
                    />
                    )}

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

                {/* Sticky Footer for Review */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t z-10 flex justify-end gap-4 md:pl-72">
                    <div className="w-full max-w-5xl mx-auto flex justify-end">
                        <Button
                            type="button"
                            size="lg"
                            onClick={handleReview}
                            className="w-full md:w-auto min-w-[200px]"
                        >
                            Review & Publish
                        </Button>
                    </div>
                </div>

                <ReviewScheduleDialog
                    isOpen={isReviewOpen}
                    onClose={() => setIsReviewOpen(false)}
                    data={form.getValues()}
                    onConfirm={handlePublish}
                    isSubmitting={isSubmitting}
                />

                <ExitDialog
                    isOpen={isExitDialogOpen}
                    onClose={() => setIsExitDialogOpen(false)}
                    onSave={handleSaveDraft}
                    onDiscard={handleDiscard}
                />
            </Form>
        </div>
    );
}
