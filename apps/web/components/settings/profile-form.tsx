"use client";

import { useState } from "react";
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
} from "@repo/ui/components/ui/dialog";
import {
    Field,
    FieldGroup,
    FieldLabel,
} from "@repo/ui/components/ui/field";
import { toast } from "sonner";
import { authClient } from "@repo/auth/client";
import { Loader2, Lock } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";

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

    // Initial state derived from props (server data)
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [phone, setPhone] = useState(user.phoneNumber || "");

    // Password change state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isPasswordLoading, setIsPasswordLoading] = useState(false);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // Placeholder for update logic
            // await authClient.updateUser({ name, image: ... })
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success("Profile updated successfully!");
        } catch (error) {
            toast.error("Failed to update profile.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match.");
            return;
        }
        setIsPasswordLoading(true);
        try {
            await authClient.changePassword({
                newPassword: newPassword,
                currentPassword: currentPassword,
                revokeOtherSessions: true,
            });
            toast.success("Password changed successfully!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setIsPasswordOpen(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to change password.");
        } finally {
            setIsPasswordLoading(false);
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
                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="full_name">Full Name</FieldLabel>
                                <Input
                                    id="full_name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                    className="bg-white"
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="email">Email Address</FieldLabel>
                                <Input
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    type="email"
                                    className="bg-white"
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="phone">Contact Number</FieldLabel>
                                <div className="relative">
                                    <Input
                                        id="phone"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+1 (555) 000-0000"
                                        type="tel"
                                        className="bg-white pr-24" // Add padding for the badge
                                    />
                                    {phone && (
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
                                                        Would you like us to send a verification code to <span className="font-bold">{phone}</span>?
                                                    </p>
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="outline" onClick={() => setIsPhoneVerifyOpen(false)}>Cancel</Button>
                                                        <Button onClick={() => {
                                                            toast.success("Verification code sent!");
                                                            setIsPhoneVerifyOpen(false);
                                                        }}>Send Code</Button>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </div>
                            </Field>
                        </FieldGroup>
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
                                    <form onSubmit={handleChangePassword} className="space-y-4 py-4">
                                        <FieldGroup>
                                            <Field>
                                                <FieldLabel htmlFor="current_password">Current Password</FieldLabel>
                                                <Input
                                                    id="current_password"
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    type="password"
                                                    required
                                                />
                                            </Field>
                                            <Field>
                                                <FieldLabel htmlFor="new_password">New Password</FieldLabel>
                                                <Input
                                                    id="new_password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    type="password"
                                                    required
                                                />
                                            </Field>
                                            <Field>
                                                <FieldLabel htmlFor="confirm_password">Confirm New Password</FieldLabel>
                                                <Input
                                                    id="confirm_password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    type="password"
                                                    required
                                                />
                                            </Field>
                                        </FieldGroup>
                                        <div className="flex justify-end pt-2">
                                            <Button type="submit" disabled={isPasswordLoading}>
                                                {isPasswordLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                                Update Password
                                            </Button>
                                        </div>
                                    </form>
                                </DialogContent>
                            </Dialog>

                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
