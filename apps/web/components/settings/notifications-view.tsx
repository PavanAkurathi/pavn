"use client";

import { useEffect, useState } from 'react';
import {
    UpdateManagerPreferencesSchema,
    type UpdateManagerPreferences,
} from '@repo/contracts/preferences';
import { useForm, Controller } from "@repo/ui/components/ui/form";
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Switch } from '@repo/ui/components/ui/switch';
import { Separator } from '@repo/ui/components/ui/separator';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@repo/ui/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@repo/ui/components/ui/toggle-group';
import { getApiBaseUrl } from '@/lib/constants';

type PreferencesForm = UpdateManagerPreferences;

export function NotificationsView() {
    const apiBaseUrl = getApiBaseUrl();
    const [loading, setLoading] = useState(true);

    const form = useForm<PreferencesForm>({
        resolver: zodResolver(UpdateManagerPreferencesSchema),
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
                const res = await fetch(`${apiBaseUrl}/manager-preferences`, {
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
            const res = await fetch(`${apiBaseUrl}/manager-preferences`, {
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

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Notification options</CardTitle>
                    <CardDescription>Loading your current notification preferences.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-0.5">
                <h3 className="text-lg font-medium">Notification options</h3>
                <p className="text-sm text-muted-foreground">Manage how and when you receive alerts about your shifts.</p>
            </div>
            <Separator />

            <Card>
                <CardHeader>
                    <CardTitle>Manager notifications</CardTitle>
                    <CardDescription>
                        Choose which live updates should reach managers and how broad the alert scope should be.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="flex flex-col gap-6">
                        <FieldSet>
                            <FieldLegend>Live shift notifications</FieldLegend>
                            <FieldGroup>
                                <Field orientation="horizontal" className="items-start justify-between">
                                    <div className="flex flex-col gap-1">
                                        <FieldLabel htmlFor="clock-in">Clock-in alerts</FieldLabel>
                                        <FieldDescription>
                                            Get notified when workers clock in to a shift you are watching.
                                        </FieldDescription>
                                    </div>
                                    <Controller
                                        control={form.control}
                                        name="clockInAlertsEnabled"
                                        render={({ field }) => (
                                            <Switch checked={field.value} onCheckedChange={field.onChange} id="clock-in" />
                                        )}
                                    />
                                </Field>

                                <Field orientation="horizontal" className="items-start justify-between">
                                    <div className="flex flex-col gap-1">
                                        <FieldLabel htmlFor="clock-out">Clock-out alerts</FieldLabel>
                                        <FieldDescription>
                                            Get notified when workers complete shifts you are watching.
                                        </FieldDescription>
                                    </div>
                                    <Controller
                                        control={form.control}
                                        name="clockOutAlertsEnabled"
                                        render={({ field }) => (
                                            <Switch checked={field.value} onCheckedChange={field.onChange} id="clock-out" />
                                        )}
                                    />
                                </Field>
                            </FieldGroup>
                        </FieldSet>

                        <FieldSet>
                            <FieldLegend>Shift scope</FieldLegend>
                            <FieldDescription>
                                Choose which shifts can trigger live notifications.
                            </FieldDescription>
                            <Controller
                                control={form.control}
                                name="shiftScope"
                                render={({ field }) => (
                                    <ToggleGroup
                                        type="single"
                                        value={field.value}
                                        onValueChange={(value) => value && field.onChange(value)}
                                        className="justify-start"
                                    >
                                        <ToggleGroupItem value="all">All shifts</ToggleGroupItem>
                                        <ToggleGroupItem value="booked_by_me">Booked by me</ToggleGroupItem>
                                        <ToggleGroupItem value="onsite_contact">On-site contact</ToggleGroupItem>
                                    </ToggleGroup>
                                )}
                            />
                        </FieldSet>

                        <FieldSet>
                            <FieldLegend>Location scope</FieldLegend>
                            <FieldDescription>
                                Limit alerts across all locations or prepare for a selected-location mode later.
                            </FieldDescription>
                            <Controller
                                control={form.control}
                                name="locationScope"
                                render={({ field }) => (
                                    <ToggleGroup
                                        type="single"
                                        value={field.value}
                                        onValueChange={(value) => value && field.onChange(value)}
                                        className="justify-start"
                                    >
                                        <ToggleGroupItem value="all">All locations</ToggleGroupItem>
                                        <ToggleGroupItem value="selected">Selected locations</ToggleGroupItem>
                                    </ToggleGroup>
                                )}
                            />
                        </FieldSet>
                    </CardContent>
                    <CardFooter className="justify-end">
                        <Button type="submit">Save preferences</Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
