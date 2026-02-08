"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addMember } from "@/actions/team";

export function AddWorkerDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phoneNumber: "",
        hourlyRate: "",
        jobTitle: "",
        inviteEmail: true,
        inviteSms: false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Convert hourly rate to cents
            const rateInCents = formData.hourlyRate ? Math.round(parseFloat(formData.hourlyRate) * 100) : undefined;

            const result = await addMember({
                name: formData.name,
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                role: "member", // Valid enforced as 'member' for Roster
                hourlyRate: rateInCents,
                jobTitle: formData.jobTitle,
                invites: {
                    email: formData.inviteEmail,
                    sms: formData.inviteSms
                }
            });

            if (result && 'error' in result) {
                toast.error(result.error);
            } else {
                toast.success("Worker added successfully");
                setOpen(false);
                setFormData({
                    name: "",
                    email: "",
                    phoneNumber: "",
                    hourlyRate: "",
                    jobTitle: "",
                    inviteEmail: true,
                    inviteSms: false
                });
            }
        } catch (error) {
            toast.error("Failed to add worker");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" data-testid="invite-worker">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Worker
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Worker</DialogTitle>
                    <DialogDescription>
                        Add a new staff member to your roster.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                name="name"
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
                                name="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="john@example.com"
                            />
                        </div>
                    </div>

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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="jobTitle">Job Title</Label>
                            <Input
                                id="jobTitle"
                                value={formData.jobTitle}
                                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                                placeholder="Security Guard"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                            <Input
                                id="hourlyRate"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.hourlyRate}
                                onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                                placeholder="25.00"
                            />
                        </div>
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
                            Add to Roster
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
