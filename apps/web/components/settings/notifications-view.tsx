"use client";

import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Switch } from '@repo/ui/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@repo/ui/components/ui/radio-group';
import { Label } from '@repo/ui/components/ui/label';
import { Separator } from '@repo/ui/components/ui/separator';

const PreferencesSchema = z.object({
    clockInAlertsEnabled: z.boolean(),
    clockOutAlertsEnabled: z.boolean(),
    shiftScope: z.enum(['all', 'booked_by_me', 'onsite_contact']),
    locationScope: z.enum(['all', 'selected']),
});

type PreferencesForm = z.infer<typeof PreferencesSchema>;

export function NotificationsView() {
    const [loading, setLoading] = useState(true);

    const form = useForm<PreferencesForm>({
        resolver: zodResolver(PreferencesSchema),
        defaultValues: {
            clockInAlertsEnabled: true,
            clockOutAlertsEnabled: true,
            shiftScope: 'all',
            locationScope: 'all',
        }
    });

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4005'}/manager-preferences`, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    form.reset(data.preferences);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const onSubmit = async (data: PreferencesForm) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4005'}/manager-preferences`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!res.ok) throw new Error("Failed to save");

            toast.success("Preferences saved successfully");
        } catch (e) {
            toast.error("Failed to save preferences");
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="space-y-0.5">
                <h3 className="text-lg font-medium">Notification options</h3>
                <p className="text-sm text-muted-foreground">Manage how and when you receive alerts about your shifts.</p>
            </div>
            <Separator />

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                {/* Live Shift Notifications */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium">Live shift notifications</h4>
                    <div className="grid gap-4">
                        <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-card">
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="clock-in" className="font-medium text-base">Clock-in alerts</Label>
                                <span className="text-sm text-muted-foreground">Get notified when Pros clock in to your shift.</span>
                            </div>
                            <Controller
                                control={form.control}
                                name="clockInAlertsEnabled"
                                render={({ field }) => (
                                    <Switch checked={field.value} onCheckedChange={field.onChange} id="clock-in" />
                                )}
                            />
                        </div>

                        <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-card">
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="clock-out" className="font-medium text-base">Clock-out alerts</Label>
                                <span className="text-sm text-muted-foreground">Get notified when Pros complete their shifts.</span>
                            </div>
                            <Controller
                                control={form.control}
                                name="clockOutAlertsEnabled"
                                render={({ field }) => (
                                    <Switch checked={field.value} onCheckedChange={field.onChange} id="clock-out" />
                                )}
                            />
                        </div>
                    </div>
                </div>

                {/* Scope Filters */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium">Filter Scope</h4>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Shift Scope</CardTitle>
                            <CardDescription>Choose which shifts trigger the alerts above.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Controller
                                control={form.control}
                                name="shiftScope"
                                render={({ field }) => (
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-3">
                                        <div className="flex items-center space-x-3 space-y-0">
                                            <RadioGroupItem value="all" id="scope-all" />
                                            <Label htmlFor="scope-all" className="font-normal">All shifts</Label>
                                        </div>
                                        <div className="flex items-center space-x-3 space-y-0">
                                            <RadioGroupItem value="booked_by_me" id="scope-booked" />
                                            <Label htmlFor="scope-booked" className="font-normal">Shifts I book or am onsite contact for</Label>
                                        </div>
                                        <div className="flex items-center space-x-3 space-y-0">
                                            <RadioGroupItem value="onsite_contact" id="scope-onsite" />
                                            <Label htmlFor="scope-onsite" className="font-normal">Only shifts I'm onsite contact for</Label>
                                        </div>
                                    </RadioGroup>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Location Scope</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Controller
                                control={form.control}
                                name="locationScope"
                                render={({ field }) => (
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-3">
                                        <div className="flex items-center space-x-3 space-y-0">
                                            <RadioGroupItem value="all" id="loc-all" />
                                            <Label htmlFor="loc-all" className="font-normal">All locations</Label>
                                        </div>
                                        <div className="flex items-center space-x-3 space-y-0">
                                            <RadioGroupItem value="selected" id="loc-selected" />
                                            <Label htmlFor="loc-selected" className="font-normal">Selected locations (Coming Soon)</Label>
                                        </div>
                                    </RadioGroup>
                                )}
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-end">
                    <Button type="submit">Save Preferences</Button>
                </div>
            </form>
        </div>
    );
}
