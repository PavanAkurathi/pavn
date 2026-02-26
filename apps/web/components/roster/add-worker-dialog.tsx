"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Plus, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { inviteWorker } from "@/actions/workers";

const addWorkerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.string().email("Invalid email address."),
    phoneNumber: z.string().optional(),
    jobTitle: z.string().optional(),
    hourlyRate: z.string().optional(),
    sendSms: z.boolean().default(true),
    sendEmail: z.boolean().default(true),
});

type AddWorkerValues = z.infer<typeof addWorkerSchema>;

export function AddWorkerDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<AddWorkerValues>({
        resolver: zodResolver(addWorkerSchema),
        defaultValues: {
            name: "",
            email: "",
            phoneNumber: "",
            jobTitle: "",
            hourlyRate: "",
            sendSms: true,
            sendEmail: true,
        },
    });

    async function onSubmit(data: AddWorkerValues) {
        setIsSubmitting(true);
        try {
            const result = await inviteWorker({
                name: data.name,
                email: data.email,
                phoneNumber: data.phoneNumber || undefined,
                role: "member", // Default to member for manual adds
                jobTitle: data.jobTitle || undefined,
                hourlyRate: data.hourlyRate ? Math.round(parseFloat(data.hourlyRate) * 100) : undefined,
                invites: {
                    email: data.sendEmail,
                    sms: data.sendSms
                }
            });

            if (result?.error) {
                toast.error(result.error);
            } else {
                toast.success("Worker successfully invited!");
                setOpen(false);
                form.reset();
                router.refresh(); // Refresh roster table data
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Worker
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Add Worker</DialogTitle>
                    <DialogDescription>
                        Enter the worker's information. A secure invitation link will be generated for them.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="John Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email Address *</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="john@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="phoneNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone Number</FormLabel>
                                        <FormControl>
                                            <Input type="tel" placeholder="+1234567890" {...field} />
                                        </FormControl>
                                        <FormDescription>Required if using SMS invites.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="jobTitle"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Primary Role/Title</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Server, Bartender" {...field} />
                                        </FormControl>
                                        <FormDescription>Can be changed later.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="hourlyRate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Hourly Rate ($)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                                        </FormControl>
                                        <FormDescription>Optional hourly pay rate.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <h3 className="text-sm font-medium">Invitation Methods</h3>
                            <div className="flex flex-col gap-3">
                                <FormField
                                    control={form.control}
                                    name="sendEmail"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="space-y-1 pl-2">
                                                <FormLabel>Send Email Invitation</FormLabel>
                                                <FormDescription>
                                                    Secure deep link delivered via email.
                                                </FormDescription>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="sendSms"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="space-y-1 pl-2">
                                                <FormLabel>Send SMS Invitation (Recommended)</FormLabel>
                                                <FormDescription>
                                                    Text message containing a direct deferred deep link to the app store.
                                                </FormDescription>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Inviting...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        Send Invitation
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
