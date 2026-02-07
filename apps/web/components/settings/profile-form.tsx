"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@repo/ui/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@repo/ui/components/ui/form";
import { toast } from "sonner";
import { authClient } from "@repo/auth/client";
import { Loader2, Lock } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";

const profileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.string().email("Please enter a valid email address."),
    phoneNumber: z.string().optional(),
});

const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export interface ProfileFormProps {
    user: {
        name: string;
        email: string;
        phoneNumber?: string | null;
        image?: string | null;
    };
}

export function ProfileForm({ user }: ProfileFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isPasswordOpen, setIsPasswordOpen] = useState(false);
    const [isPhoneVerifyOpen, setIsPhoneVerifyOpen] = useState(false);

    const form = useForm<z.infer<typeof profileSchema>>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber || "",
        },
    });

    const passwordForm = useForm<z.infer<typeof passwordSchema>>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
        setIsLoading(true);
        try {
            // Placeholder for update logic
            // await authClient.updateUser({ name: values.name, ... })
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success("Profile updated successfully!");
        } catch (error) {
            toast.error("Failed to update profile.");
        } finally {
            setIsLoading(false);
        }
    };

    const onPasswordSubmit = async (values: z.infer<typeof passwordSchema>) => {
        try {
            await authClient.changePassword({
                newPassword: values.newPassword,
                currentPassword: values.currentPassword,
                revokeOtherSessions: true,
            });
            toast.success("Password changed successfully!");
            passwordForm.reset();
            setIsPasswordOpen(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to change password.");
        }
    };

    return (
        <div className="space-y-6">
            {/* General Profile Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your personal details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...(form as any)}>
                        <form onSubmit={form.handleSubmit(onProfileSubmit)} className="space-y-6">
                            <FormField
                                control={form.control as any}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="John Doe" className="bg-white" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control as any}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email Address</FormLabel>
                                        <FormControl>
                                            <Input placeholder="user@example.com" type="email" className="bg-white" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control as any}
                                name="phoneNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contact Number</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input placeholder="+1 (555) 000-0000" type="tel" className="bg-white pr-24" {...field} />
                                                {field.value && (
                                                    <Dialog open={isPhoneVerifyOpen} onOpenChange={setIsPhoneVerifyOpen}>
                                                        <DialogTrigger asChild>
                                                            <Badge
                                                                variant="secondary"
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer hover:bg-red-100 bg-red-50 text-red-600 hover:text-red-700 border-red-100"
                                                            >
                                                                Not Verified
                                                            </Badge>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Verify Phone Number</DialogTitle>
                                                                <DialogDescription>
                                                                    We need to verify your phone number to secure your account.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="py-4 space-y-4">
                                                                <p className="text-sm text-slate-600">
                                                                    Would you like us to send a verification code to <span className="font-bold">{field.value}</span>?
                                                                </p>
                                                                <div className="flex justify-end gap-2">
                                                                    <Button type="button" variant="outline" onClick={() => setIsPhoneVerifyOpen(false)}>Cancel</Button>
                                                                    <Button type="button" onClick={() => {
                                                                        toast.success("Verification code sent!");
                                                                        setIsPhoneVerifyOpen(false);
                                                                    }}>Send Code</Button>
                                                                </div>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-between items-center pt-4 border-t">
                                <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="outline" size="sm">
                                            <Lock className="w-3 h-3 mr-2" />
                                            Change Password
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Change Password</DialogTitle>
                                            <DialogDescription>
                                                Enter your current password to set a new one.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <Form {...(passwordForm as any)}>
                                            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 py-4">
                                                <FormField
                                                    control={passwordForm.control as any}
                                                    name="currentPassword"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Current Password</FormLabel>
                                                            <FormControl>
                                                                <Input type="password" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={passwordForm.control as any}
                                                    name="newPassword"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>New Password</FormLabel>
                                                            <FormControl>
                                                                <Input type="password" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={passwordForm.control as any}
                                                    name="confirmPassword"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Confirm New Password</FormLabel>
                                                            <FormControl>
                                                                <Input type="password" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <DialogFooter>
                                                    <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                                                        {passwordForm.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                                        Update Password
                                                    </Button>
                                                </DialogFooter>
                                            </form>
                                        </Form>
                                    </DialogContent>
                                </Dialog>

                                <Button type="submit" disabled={isLoading}>
                                    {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
