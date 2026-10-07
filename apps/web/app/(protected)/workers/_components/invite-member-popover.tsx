"use client";

import { useState } from "react";
import { useForm } from "@repo/ui/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@repo/ui/components/ui/collapsible";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { inviteWorker } from "@/actions/workers";

const inviteSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    phoneNumber: z
        .string()
        .optional()
        .refine((val) => !val || /^\s*\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\s*$/.test(val), "Must be a valid US/Canada phone number"),
    roles: z.string().optional(),
    hourlyRate: z
        .string()
        .optional()
        .refine((val) => !val || /^\d+(\.\d{1,2})?$/.test(val), "Must be a valid number (e.g. 15.50)"),
    sendSms: z.boolean().default(true),
}).superRefine((value, ctx) => {
    // The phone number is the only way into the app, so there is nothing to text without one.
    if (value.sendSms && !value.phoneNumber?.trim()) {
        ctx.addIssue({ code: "custom", path: ["phoneNumber"], message: "Add a phone number to send the invite, or untick the text." });
    }
});

type InviteFormValues = z.input<typeof inviteSchema>;
type InviteSubmitValues = z.output<typeof inviteSchema>;

const splitRoles = (value: string | undefined) =>
    (value ?? "")
        .split(/[,;\n|]+/)
        .map((role) => role.trim())
        .filter(Boolean);

/**
 * "+ Add worker": a small popover with the few things a worker needs. The
 * business owns the record. If asked, the worker is texted a link and a code to
 * join the app; the first role becomes their primary role.
 */
export function InviteMemberPopover() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<InviteFormValues, unknown, InviteSubmitValues>({
        resolver: zodResolver(inviteSchema),
        defaultValues: { name: "", phoneNumber: "", roles: "", hourlyRate: "", sendSms: true },
    });

    async function onSubmit(data: InviteSubmitValues) {
        setIsSubmitting(true);
        try {
            const roles = splitRoles(data.roles);
            const result = await inviteWorker({
                name: data.name,
                phoneNumber: data.phoneNumber || undefined,
                roles,
                jobTitle: roles[0],
                hourlyRate: data.hourlyRate ? Math.round(parseFloat(data.hourlyRate) * 100) : undefined,
                invites: { sms: data.sendSms },
            });

            if (result?.error) {
                toast.error(result.error);
            } else {
                toast.success(data.sendSms ? "Added. Invite sent by text." : "Added. No invite sent yet.");
                setOpen(false);
                form.reset();
                router.refresh(); // Refresh the worker list
            }
        } catch {
            toast.error("An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button size="sm">
                    <Plus data-icon="inline-start" />
                    Add worker
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-[calc(100vh-6rem)] w-[22rem] overflow-y-auto p-4">
                <h2 className="text-[13px] font-bold">Add worker</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    They can only join the app with the invite you send: a text with a link and a code.
                </p>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="mt-3 flex flex-col gap-3">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Casey L." autoComplete="off" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phone number</FormLabel>
                                    <FormControl>
                                        <Input type="tel" placeholder="(312) 555-0100" autoComplete="off" {...field} />
                                    </FormControl>
                                    <FormDescription>Their way into the app. Needed to send the invite.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="roles"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Server, Bartender" autoComplete="off" {...field} />
                                    </FormControl>
                                    <FormDescription>Comma-separated. The first is their main role.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Collapsible>
                            <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-semibold text-primary">
                                More
                                <ChevronDown aria-hidden className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-2">
                                <FormField
                                    control={form.control}
                                    name="hourlyRate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Hourly rate</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                                            </FormControl>
                                            {/* Timesheet exports report hours, not pay: the payroll system applies rates. */}
                                            <FormDescription>
                                                For your reference. Timesheet exports report hours, not pay.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CollapsibleContent>
                        </Collapsible>

                        <div className="flex flex-col gap-2 border-t pt-3">
                            <FormField
                                control={form.control}
                                name="sendSms"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center gap-2">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel className="font-medium">Text them the invite now</FormLabel>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button type="submit" size="sm" className="flex-1" disabled={isSubmitting}>
                                {isSubmitting ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                                {isSubmitting ? "Adding…" : form.watch("sendSms") ? "Add & send invite" : "Add worker"}
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                        </div>
                    </form>
                </Form>
            </PopoverContent>
        </Popover>
    );
}
