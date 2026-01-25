'use client';

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

export default function ManagerNotificationsPage() {
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
        // Fetch current prefs
        // Using direct fetch to the API service URL if exposed, or NextJS proxy.
        // Based on `proxy.ts` in file list, there might be a typed client.
        // I'll stick to a generic fetch to the API Service assuming cors/proxy setup.
        // Or if this is a server component... but this is 'use client'.

        async function load() {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4006'}/manager-preferences`, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                // If 401, handle auth.
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
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4006'}/manager-preferences`, {
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

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="container max-w-2xl py-10">
            <h1 className="text-3xl font-bold mb-2">Notification options</h1>
            <p className="text-muted-foreground mb-8">Manage how and when you receive alerts about your shifts.</p>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                {/* Live Shift Notifications */}
                <Card>
                    <CardHeader>
                        <CardTitle>Live shift notifications</CardTitle>
                        <CardDescription>Receive real-time updates for the day of the shift.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2">
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="clock-in" className="font-semibold text-base">Clock-in alerts</Label>
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

                        <Separator />

                        <div className="flex items-center justify-between space-x-2">
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="clock-out" className="font-semibold text-base">Clock-out alerts</Label>
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
                    </CardContent>
                </Card>

                {/* Scope Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle>Filter Scope</CardTitle>
                        <CardDescription>Choose which shifts trigger the alerts above.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">

                        <Controller
                            control={form.control}
                            name="shiftScope"
                            render={({ field }) => (
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-3">
                                    <div className="flex items-center space-x-3 space-y-0">
                                        <RadioGroupItem value="all" id="scope-all" />
                                        <Label htmlFor="scope-all" className="font-normal text-base">All shifts</Label>
                                    </div>
                                    <div className="flex items-center space-x-3 space-y-0">
                                        <RadioGroupItem value="booked_by_me" id="scope-booked" />
                                        <Label htmlFor="scope-booked" className="font-normal text-base">Shifts I book or am onsite contact for</Label>
                                    </div>
                                    <div className="flex items-center space-x-3 space-y-0">
                                        <RadioGroupItem value="onsite_contact" id="scope-onsite" />
                                        <Label htmlFor="scope-onsite" className="font-normal text-base">Only shifts I'm onsite contact for</Label>
                                    </div>
                                </RadioGroup>
                            )}
                        />

                        <Separator />

                        <Controller
                            control={form.control}
                            name="locationScope"
                            render={({ field }) => (
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-3">
                                    <div className="flex items-center space-x-3 space-y-0">
                                        <RadioGroupItem value="all" id="loc-all" />
                                        <Label htmlFor="loc-all" className="font-normal text-base">All locations</Label>
                                    </div>
                                    <div className="flex items-center space-x-3 space-y-0">
                                        <RadioGroupItem value="selected" id="loc-selected" />
                                        <Label htmlFor="loc-selected" className="font-normal text-base">Selected locations (Coming Soon)</Label>
                                    </div>
                                </RadioGroup>
                            )}
                        />

                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button type="submit" size="lg">Apply</Button>
                </div>

            </form>
        </div>
    );
}
