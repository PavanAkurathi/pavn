"use strict";

"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addMember } from "@/actions/team";

export function AddMemberDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phoneNumber: "",
        role: "member" as "admin" | "member",
        jobTitle: "",
        inviteEmail: true,
        inviteSms: false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await addMember({
                name: formData.name,
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                role: formData.role,
                jobTitle: formData.jobTitle,
                invites: {
                    email: formData.inviteEmail,
                    sms: formData.inviteSms
                }
            });

            if (result && 'error' in result) {
                toast.error(result.error);
            } else {
                toast.success("Member added successfully");
                setOpen(false);
                setFormData({
                    name: "",
                    email: "",
                    phoneNumber: "",
                    role: "member",
                    jobTitle: "",
                    inviteEmail: true,
                    inviteSms: false
                });
            }
        } catch (error) {
            toast.error("Failed to add member");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Member
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                    <DialogDescription>
                        Add a new member to your organization. They will act as a "Shadow User" until they accept the invite.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="john@example.com"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone (Optional)</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={formData.phoneNumber}
                                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                placeholder="+1 (555) 000-0000"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(val: "admin" | "member") => setFormData({ ...formData, role: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="jobTitle">Job Title</Label>
                        <Input
                            id="jobTitle"
                            value={formData.jobTitle}
                            onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                            placeholder="Security Guard"
                        />
                    </div>
                    <div className="space-y-3 pt-2">
                        <Label>Invitation Methods</Label>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="inviteEmail"
                                    checked={formData.inviteEmail}
                                    onCheckedChange={(c) => setFormData({ ...formData, inviteEmail: c as boolean })}
                                />
                                <Label htmlFor="inviteEmail">Send Email</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="inviteSms"
                                    checked={formData.inviteSms}
                                    onCheckedChange={(c) => setFormData({ ...formData, inviteSms: c as boolean })}
                                />
                                <Label htmlFor="inviteSms">Send SMS</Label>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Member
                        </Button>
                    </DialogFooter>
                </form >
            </DialogContent >
        </Dialog >
    );
}
