"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Label } from "@repo/ui/components/ui/label";
import { Switch } from "@repo/ui/components/ui/switch";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function NotificationsForm() {
    const [isLoading, setIsLoading] = useState(false);

    // Mock state for notifications
    const [preferences, setPreferences] = useState({
        admin: {
            newSignUp: true,
            weeklyReport: true,
            systemAlerts: true,
        },
        manager: {
            shiftUpdates: true,
            memberRequests: false,
        }
    });

    const handleSave = async () => {
        setIsLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsLoading(false);
        toast.success("Notification preferences updated.");
    };

    const toggle = (role: 'admin' | 'manager', key: string) => {
        setPreferences(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [key]: !((prev[role] as any)[key])
            }
        }));
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>
                        Manage what notifications you receive based on your role context.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Admin Context */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Admin Context</h3>
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="admin-signup" className="flex flex-col space-y-1">
                                <span>New User Signups</span>
                                <span className="font-normal text-xs text-muted-foreground">Receive an email when a new user joins the organization.</span>
                            </Label>
                            <Switch
                                id="admin-signup"
                                checked={preferences.admin.newSignUp}
                                onCheckedChange={() => toggle('admin', 'newSignUp')}
                            />
                        </div>
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="admin-report" className="flex flex-col space-y-1">
                                <span>Weekly Reports</span>
                                <span className="font-normal text-xs text-muted-foreground">Get a weekly summary of organization activity.</span>
                            </Label>
                            <Switch
                                id="admin-report"
                                checked={preferences.admin.weeklyReport}
                                onCheckedChange={() => toggle('admin', 'weeklyReport')}
                            />
                        </div>
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="admin-alerts" className="flex flex-col space-y-1">
                                <span>System Alerts</span>
                                <span className="font-normal text-xs text-muted-foreground">Critical updates about system status and security.</span>
                            </Label>
                            <Switch
                                id="admin-alerts"
                                checked={preferences.admin.systemAlerts}
                                onCheckedChange={() => toggle('admin', 'systemAlerts')}
                            />
                        </div>
                    </div>

                    {/* Manager Context */}
                    <div className="space-y-4 pt-4 border-t">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Manager Context</h3>
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="mgr-shifts" className="flex flex-col space-y-1">
                                <span>Shift Updates</span>
                                <span className="font-normal text-xs text-muted-foreground">Notifications about shift changes and scheduling conflicts.</span>
                            </Label>
                            <Switch
                                id="mgr-shifts"
                                checked={preferences.manager.shiftUpdates}
                                onCheckedChange={() => toggle('manager', 'shiftUpdates')}
                            />
                        </div>
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="mgr-requests" className="flex flex-col space-y-1">
                                <span>Member Requests</span>
                                <span className="font-normal text-xs text-muted-foreground">Time-off requests and role changes.</span>
                            </Label>
                            <Switch
                                id="mgr-requests"
                                checked={preferences.manager.memberRequests}
                                onCheckedChange={() => toggle('manager', 'memberRequests')}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button onClick={handleSave} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Preferences
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
