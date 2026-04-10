"use client";

import { useState } from "react";
import { useForm } from "@repo/ui/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
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
import { Separator } from "@repo/ui/components/ui/separator";
import { toast } from "sonner";
import { authClient } from "@repo/auth/client";
import { Lock } from "lucide-react";
import { Spinner } from "@repo/ui/components/ui/spinner";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@repo/ui/components/ui/input-group";

const profileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.string().email("Please enter a valid email address."),
    phoneNumber: z.string().optional().refine((val) => !val || /^\s*\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\s*$/.test(val), "Must be a valid US/Canada phone number"),
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
        <div className="flex flex-col gap-6">
            {/* General Profile Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your personal details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...(form as any)}>
                        <form onSubmit={form.handleSubmit(onProfileSubmit)} className="flex flex-col gap-6">
                            <FormField
                                control={form.control as any}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="John Doe" {...field} />
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
                                            <Input placeholder="user@example.com" type="email" {...field} />
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
                                            <div className="flex flex-col gap-2">
                                                <InputGroup>
                                                    <InputGroupInput placeholder="+1 (555) 000-0000" type="tel" {...field} />
                                                    {field.value && (
                                                        <InputGroupAddon align="inline-end">
                                                            <Dialog open={isPhoneVerifyOpen} onOpenChange={setIsPhoneVerifyOpen}>
                                                                <DialogTrigger asChild>
                                                                    <InputGroupButton size="sm" variant="outline">
                                                                        Verify phone
                                                                    </InputGroupButton>
                                                                </DialogTrigger>
                                                                <DialogContent>
                                                                    <DialogHeader>
                                                                        <DialogTitle>Verify phone number</DialogTitle>
                                                                        <DialogDescription>
                                                                            We need to verify your phone number to secure your account.
                                                                        </DialogDescription>
                                                                    </DialogHeader>
                                                                    <div className="flex flex-col gap-4 py-4">
                                                                        <Alert>
                                                                            <AlertTitle>Verification required</AlertTitle>
                                                                            <AlertDescription>
                                                                                Would you like us to send a verification code to{" "}
                                                                                <span className="font-medium text-foreground">{field.value}</span>?
                                                                            </AlertDescription>
                                                                        </Alert>
                                                                        <div className="flex justify-end gap-2">
                                                                            <Button type="button" variant="outline" onClick={() => setIsPhoneVerifyOpen(false)}>
                                                                                Cancel
                                                                            </Button>
                                                                            <Button type="button" onClick={() => {
                                                                                toast.success("Verification code sent!");
                                                                                setIsPhoneVerifyOpen(false);
                                                                            }}>
                                                                                Send code
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </DialogContent>
                                                            </Dialog>
                                                        </InputGroupAddon>
                                                    )}
                                                </InputGroup>
                                                {field.value && (
                                                    <p className="text-sm text-muted-foreground">
                                                        This number is still unverified.
                                                    </p>
                                                )}
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Separator />

                            <div className="flex items-center justify-between gap-3">
                                <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="outline" size="sm">
                                            <Lock data-icon="inline-start" />
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
                                            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="flex flex-col gap-4 py-4">
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
                                                        {passwordForm.formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                                                        Update Password
                                                    </Button>
                                                </DialogFooter>
                                            </form>
                                        </Form>
                                    </DialogContent>
                                </Dialog>

                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? <Spinner data-icon="inline-start" /> : null}
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
