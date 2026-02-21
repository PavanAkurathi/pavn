// apps/web/components/schedule/create-schedule-form.tsx

"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { useFieldArray } from "@repo/ui/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, X } from "lucide-react";
import posthog from "posthog-js";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@repo/ui/components/ui/form";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { authClient } from "@repo/auth/client";
import { useLocations, useContacts, useOrganizationId } from "@/hooks/use-schedule-data";
import { useCrewData } from "@/hooks/use-crew-data";
import { LocationPicker } from "./location-picker";
import { ContactPicker } from "./contact-picker";
import { ScheduleBlock } from "./schedule-block";
import { ReviewScheduleDialog } from "./review-schedule-dialog";
import { publishSchedule, deleteDrafts } from "@/lib/api/shifts";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExitDialog } from "@repo/ui/components/ui/exit-dialog";
import { AddLocationModal } from "../settings/add-location-modal";
import { createLocation } from "@/actions/locations";

// Schema Definitions
const PositionSchema = z.object({
    id: z.string().optional(),
    roleId: z.string().min(1, "Role ID is required"),
    roleName: z.string().min(1, "Role Name is required"),
    workerId: z.any(),
    workerName: z.any(),
    workerAvatar: z.any(),
    workerInitials: z.any(),
});

const ScheduleBlockSchema = z.object({
    scheduleName: z.string().optional(),
    // Standard Mode: Multiple dates
    dates: z.array(z.date()).optional(),
    // Recurring Mode Fields
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    daysOfWeek: z.array(z.number()).optional(), // 0=Sun, 1=Mon...

    startTime: z.string().min(1, "Required"),
    endTime: z.string().min(1, "Required"),
    breakDuration: z.string(),
    positions: z.array(PositionSchema).min(1, "At least one position is required"),
}).refine(data => {
    // Validation: Either dates array (Standard) OR Start/End/Days (Recurring)
    if (data.startDate || data.endDate || data.daysOfWeek?.length) {
        return !!(data.startDate && data.endDate && data.daysOfWeek?.length);
    }
    return !!(data.dates && data.dates.length > 0);
}, { message: "Please select dates or configure recurrence." });

const formSchema = z.object({
    locationId: z.string().min(1, "Please select a location"),
    managerIds: z.array(z.string()).min(1, "Please select at least one manager"),
    schedules: z.array(ScheduleBlockSchema).min(1, "At least one schedule is required"),
});

import { CrewMember } from "@/hooks/use-crew-data";
import { Switch } from "@repo/ui/components/ui/switch";
import { Label } from "@repo/ui/components/ui/label";

export type FormValues = z.infer<typeof formSchema>;

interface CreateScheduleFormProps {
    initialData?: FormValues;
    prefetchedCrew?: CrewMember[];
}

const DEFAULT_SCHEDULE_BLOCK = {
    scheduleName: "",
    breakDuration: "0",
    startTime: "",
    endTime: "",
    positions: [],
    dates: [],
    daysOfWeek: [],
};

export function CreateScheduleForm({ initialData, prefetchedCrew }: CreateScheduleFormProps) {
    // 1. Hook Definitions
    const { data: locations, mutate: mutateLocations } = useLocations();
    const { data: contacts } = useContacts();
    const activeOrganizationId = useOrganizationId();
    const { roles, crew: hookCrew } = useCrewData();
    const crew = prefetchedCrew && prefetchedCrew.length > 0 ? prefetchedCrew : hookCrew;

    const { data: session } = authClient.useSession();
    const currentUserId = session?.user?.id;
    const router = useRouter();
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
    const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
    const [isRecurring, setIsRecurring] = useState(false);

    // 2. Form Setup
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: initialData || {
            locationId: "",
            managerIds: [],
            schedules: [{ ...DEFAULT_SCHEDULE_BLOCK } as any],
        },
    });

    const { fields, append, remove, insert } = useFieldArray({
        control: form.control,
        name: "schedules",
    });

    // Ensure we always have exactly one block
    useEffect(() => {
        if (fields.length === 0) {
            append({ ...DEFAULT_SCHEDULE_BLOCK } as any);
        }
    }, [fields.length, append]);

    // Auto-select Location if only one exists
    useEffect(() => {
        if (locations && locations.length === 1 && !form.getValues("locationId")) {
            const singleLocation = locations[0];
            if (singleLocation) form.setValue("locationId", singleLocation.id);
        }
    }, [locations, form]);

    // Auto-select Manager: 
    // 1. If only one contact exists -> select it.
    // 2. If current user is in contacts list -> select it (append if needed).
    useEffect(() => {
        if (!contacts) return;
        const currentManagers = form.getValues("managerIds");

        // Strategy A: Only one contact exists
        if (contacts.length === 1 && currentManagers.length === 0) {
            const singleContact = contacts[0];
            if (singleContact) {
                form.setValue("managerIds", [singleContact.id]);
            }
            return;
        }

        // Strategy B: Current user is a contact
        if (currentUserId) {
            const userContact = contacts.find(c => c.userId === currentUserId || c.id === currentUserId);
            if (userContact && !currentManagers.includes(userContact.id)) {
                // Determine if we should replace or append. 
                // "Default to be shown" usually implies initial state. 
                // We'll append to be safe, or set single if empty.
                if (currentManagers.length === 0) {
                    form.setValue("managerIds", [userContact.id]);
                } else {
                    // If conflicting, maybe don't force it? But user said "whoever logs in... SHOULD be shown".
                    // Let's safe-append unique.
                    const newIds = Array.from(new Set([...currentManagers, userContact.id]));
                    form.setValue("managerIds", newIds);
                }
            }
        }
    }, [contacts, currentUserId, form]);

    const handleReview = async () => {
        console.log("DEBUG: handleReview clicked");
        const isValid = await form.trigger();
        console.log(`DEBUG: form.trigger() result: ${isValid}`);
        if (isValid) {
            console.log("DEBUG: Setting isReviewOpen = true");
            setIsReviewOpen(true);
        } else {
            const errors = form.formState.errors;
            console.error("VALIDATION ERROR:", JSON.stringify(errors, null, 2));
            const missingFields = Object.keys(errors).map(key => key).join(", ");
            toast.error(`Please check missing fields.`);
        }
    };

    const handlePublish = async (status: 'published' | 'draft') => {
        setIsSubmitting(true);
        try {
            const data = form.getValues();
            const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (!activeOrganizationId) {
                toast.error("Organization ID missing. Please log in again.");
                return;
            }

            // Client-side Expansion of Recurrence or Multi-Dates
            const apiSchedules: any[] = [];
            let globalRecurrence: any = undefined;

            if (isRecurring) {
                // Ensure we have valid recurrence data from the first block (UI constraints enforce single pattern)
                const template = data.schedules[0];
                if (template?.startDate && template?.endDate) {
                    globalRecurrence = {
                        enabled: true,
                        pattern: 'weekly', // Currently hardcoded in UI logic
                        daysOfWeek: template.daysOfWeek || [],
                        endType: 'on_date',
                        endDate: format(template.endDate, "yyyy-MM-dd")
                    };
                }
            }

            // Iterate blocks to format them
            for (const schedule of data.schedules) {
                let targetDates: string[] = [];

                if (isRecurring && schedule.startDate) {
                    // For recurrence, we send the ANCHOR date (startDate)
                    // The backend will expand this using the globalRecurrence object.
                    targetDates = [format(schedule.startDate, "yyyy-MM-dd")];
                } else if (schedule.dates && schedule.dates.length > 0) {
                    // Standard mode: explicit dates
                    targetDates = schedule.dates.map(d => format(d, "yyyy-MM-dd"));
                }

                // If no dates generated (validation should have caught this), skip
                if (targetDates.length === 0) continue;

                // Group Positions
                const roleGroups: { [roleName: string]: (string | null)[] } = {};
                schedule.positions.forEach(pos => {
                    if (!roleGroups[pos.roleName]) roleGroups[pos.roleName] = [];
                    roleGroups[pos.roleName]!.push(pos.workerId || null);
                });
                const formattedPositions = Object.entries(roleGroups).map(([roleName, workerIds]) => ({
                    roleName,
                    workerIds
                    // price: 0 // REMOVED per WOR-26
                }));

                // Push ONE payload item
                apiSchedules.push({
                    scheduleName: schedule.scheduleName || "Untitled Schedule",
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    dates: targetDates,
                    positions: formattedPositions
                });
            }

            const payload = {
                locationId: data.locationId,
                organizationId: activeOrganizationId,
                contactId: data.managerIds[0],
                timezone: clientTimezone,
                status,
                recurrence: globalRecurrence,
                schedules: apiSchedules
            };

            console.log("DEBUG: Calling publishSchedule API", payload);
            await publishSchedule(payload, activeOrganizationId);
            console.log("DEBUG: publishSchedule API success");

            // Track schedule publish
            posthog.capture('schedule_published', {
                status: status,
                location_id: data.locationId,
                shift_count: apiSchedules.length
            });

            toast.success(status === 'published' ? "Schedule published successfully!" : "Draft saved successfully!");
            localStorage.removeItem("schedule-layout-draft");

            console.log("DEBUG: Calling router.push");
            router.push("/dashboard/shifts");
            console.log("DEBUG: router.push called");
        } catch (error) {
            console.error("Publish error:", error);
            toast.error("Failed to publish schedule.");
        } finally {
            setIsSubmitting(false);
            setIsReviewOpen(false);
        }
    };

    // ... (Keep handleExit, handleSaveDraft, handleDiscard) ...
    const handleExit = () => {
        // Check if form is effectively empty/dirty
        const values = form.getValues();
        const hasActiveSchedule = values.schedules.some(s => {
            const hasDates = isRecurring
                ? (s.startDate || s.daysOfWeek?.length)
                : (s.dates && s.dates.length > 0);
            const hasPositions = s.positions && s.positions.length > 0;
            return hasDates || hasPositions || s.startTime || s.endTime;
        });

        if (!hasActiveSchedule) {
            router.push("/dashboard/shifts");
            return;
        }

        setIsExitDialogOpen(true);
    };

    const handleSaveDraft = async (e: React.MouseEvent) => {
        // Validation for Drafts: Must have minimal config (Date + Position)
        const values = form.getValues();
        const validDraft = values.schedules.some(s => {
            const hasDates = isRecurring
                ? (s.startDate && s.endDate && s.daysOfWeek?.length)
                : (s.dates && s.dates.length > 0);
            const hasPositions = s.positions && s.positions.length > 0;
            return hasDates && hasPositions;
        });

        if (!validDraft) {
            e.preventDefault();
            toast.error("Cannot save draft: Please select at least a date and one position.");
            return;
        }

        handlePublish('draft');
    };
    const handleDiscard = async () => {
        await deleteDrafts(activeOrganizationId);
        localStorage.removeItem("schedule-layout-draft");
        router.push("/dashboard/shifts");
    };

    return (
        <div className="max-w-5xl mx-auto py-6 space-y-8">

            <Form {...(form as any)}>

                {/* SECTION 1: WORK LOCATION */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold tracking-tight">Work Location</h2>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control as any}
                                    name="locationId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <LocationPicker
                                                    locations={locations}
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    onAddLocation={() => setIsAddLocationOpen(true)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control as any}
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
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* SECTION 2: BUILD SCHEDULE */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold tracking-tight">Build your schedule</h2>
                        <div className="flex items-center space-x-2">
                            <Label htmlFor="recurring-mode" className="text-sm font-medium text-muted-foreground">Recurring schedule</Label>
                            <Switch
                                id="recurring-mode"
                                checked={isRecurring}
                                onCheckedChange={setIsRecurring}
                            />
                        </div>
                    </div>

                    {/* Single Schedule Block */}
                    {fields.map((field, index) => (
                        <ScheduleBlock
                            key={field.id}
                            index={index}
                            onRemove={() => remove(index)}
                            onDuplicate={() => {
                                // Basic duplicate logic
                            }}
                            canDelete={fields.length > 1}
                            roles={roles}
                            crew={crew}
                            isRecurring={isRecurring}
                        />
                    ))}

                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            // Validation: Check if the last block is sufficiently filled
                            const currentSchedules = form.getValues("schedules");
                            const lastSchedule = currentSchedules[currentSchedules.length - 1];

                            if (!lastSchedule) {
                                append({ ...DEFAULT_SCHEDULE_BLOCK } as any);
                                return;
                            }

                            // Basic check: dates/recurrence and at least one position
                            const hasDates = isRecurring
                                ? (lastSchedule.startDate && lastSchedule.endDate && lastSchedule.daysOfWeek?.length)
                                : (lastSchedule.dates && lastSchedule.dates.length > 0);

                            const hasTimes = lastSchedule.startTime && lastSchedule.endTime;
                            const hasPositions = lastSchedule.positions && lastSchedule.positions.length > 0;

                            if (!hasDates || !hasTimes || !hasPositions) {
                                toast.warning("Please complete the current schedule block before adding a new one.");
                                return;
                            }

                            append({ ...DEFAULT_SCHEDULE_BLOCK } as any);
                        }}
                        className="w-full py-8 text-indigo-600 hover:text-indigo-700 bg-white border-dashed border-2 hover:bg-gray-50 flex items-center justify-center gap-2 group h-auto"
                    >
                        <Plus className="h-5 w-5 transition-transform group-hover:scale-110" />
                        <span className="text-base font-medium">+ Add Schedule</span>
                    </Button>
                </div>

                <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                    <Button variant="ghost" type="button" onClick={handleExit}>Cancel</Button>
                    <Button
                        type="button"
                        onClick={handleReview}
                        data-testid="review-publish"
                        className="bg-indigo-600 hover:bg-indigo-700 min-w-[200px]"
                    >
                        Review & Publish
                    </Button>
                </div>

                <ReviewScheduleDialog
                    isOpen={isReviewOpen}
                    onClose={() => setIsReviewOpen(false)}
                    data={form.getValues()}
                    onConfirm={() => handlePublish('published')}
                    isSubmitting={isSubmitting}
                />

                <ExitDialog
                    isOpen={isExitDialogOpen}
                    onClose={() => setIsExitDialogOpen(false)}
                    onSave={handleSaveDraft}
                    onDiscard={handleDiscard}
                />

                <AddLocationModal
                    open={isAddLocationOpen}
                    onOpenChange={setIsAddLocationOpen}
                    onSave={async (data) => {
                        const res = await createLocation({ ...data, timezone: "UTC" });
                        if (res.success) {
                            mutateLocations();
                            return {};
                        }
                        return res;
                    }}
                />
            </Form>
        </div>
    );
}
