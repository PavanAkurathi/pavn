//  apps/web/components/settings/settings-view.tsx

"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Separator } from "@repo/ui/components/ui/separator";
import { User, Building, MapPin, Users, CreditCard, Shield, Bell } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

import { ProfileForm } from "@/components/settings/profile-form";
import { BusinessForm } from "@/components/settings/business-form";
import { LocationsForm } from "@/components/settings/locations-form";
import { SecurityForm } from "@/components/settings/security-form";
import { TeamList } from "@/components/settings/team-list";
import { BillingView } from "@/components/settings/billing/billing-view";
import { NotificationsView } from "@/components/settings/notifications-view";
import { deleteLocation, createLocation, updateLocation } from "@/actions/locations";

interface SettingsViewProps {
    user: any;
    organization: any;
    locations: any[];
    role: string;
    sessions: any[];
    accounts: any[];
    members: any[];
    activeTab: string;
    subscription: { status: string; currentPeriodEnd?: Date };
    invoices: any[];
}

export function SettingsView({
    user,
    organization,
    locations,
    sessions,
    accounts,
    members,
    activeTab,
    subscription,
    invoices
}: SettingsViewProps) {
    const router = useRouter();

    const handleTabChange = (value: string) => {
        router.push(`/settings/${value}`);
    };

    return (
        <div className="space-y-6 block pb-16 max-w-5xl">
            <div className="space-y-0.5">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">Manage your account and workspace.</p>
            </div>
            <Separator className="my-6" />

            <Tabs
                orientation="vertical"
                defaultValue="profile"
                value={activeTab}
                onValueChange={handleTabChange}
                className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0"
            >
                <aside className="-mx-4 lg:w-1/5 px-4 lg:px-0">
                    <TabsList className="flex flex-col h-auto bg-transparent p-0 space-y-1">
                        <TabItem value="profile" icon={<User className="w-4 h-4" />} label="Profile" />
                        <TabItem value="security" icon={<Shield className="w-4 h-4" />} label="Security" />
                        <TabItem value="business" icon={<Building className="w-4 h-4" />} label="Business" />
                        <TabItem value="notifications" icon={<Bell className="w-4 h-4" />} label="Notifications" />
                        <TabItem value="locations" icon={<MapPin className="w-4 h-4" />} label="Locations" />
                        <TabItem value="team" icon={<Users className="w-4 h-4" />} label="Team" />
                        <TabItem value="billing" icon={<CreditCard className="w-4 h-4" />} label="Billing" />
                    </TabsList>
                </aside>

                <div className="flex-1">
                    <TabsContent value="profile" className="mt-0 space-y-6">
                        <ProfileForm user={user} />
                    </TabsContent>

                    <TabsContent value="security" className="mt-0 space-y-6">
                        <SecurityForm sessions={sessions} accounts={accounts} />
                    </TabsContent>

                    <TabsContent value="business" className="mt-0 space-y-6">
                        <BusinessForm organization={organization} />
                    </TabsContent>

                    <TabsContent value="locations" className="mt-0 space-y-6">
                        <LocationsForm
                            locations={locations}
                            onDelete={deleteLocation}
                            onAdd={createLocation}
                            onUpdate={updateLocation}
                        />
                    </TabsContent>

                    <TabsContent value="team" className="mt-0 space-y-6">
                        <TeamList members={members} />
                    </TabsContent>

                    <TabsContent value="notifications" className="mt-0 space-y-6">
                        <NotificationsView />
                    </TabsContent>

                    <TabsContent value="billing" className="mt-0 space-y-6">
                        <BillingView
                            subscriptionStatus={subscription?.status || "inactive"}
                            currentPeriodEnd={subscription?.currentPeriodEnd}
                            invoices={invoices}
                        />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}

function TabItem({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
    return (
        <TabsTrigger
            value={value}
            className={cn(
                "w-full justify-start gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-md",
                "text-muted-foreground hover:bg-slate-100 hover:text-slate-900",
                "data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:font-semibold"
            )}
        >
            {icon}
            {label}
        </TabsTrigger>
    );
}