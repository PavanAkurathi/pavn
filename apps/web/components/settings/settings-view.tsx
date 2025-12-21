"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { User, Building, MapPin, Users, CreditCard, History } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

import { ProfileForm } from "@/components/settings/profile-form";
import { BusinessForm } from "@/components/settings/business-form";
import { LocationsForm } from "@/components/settings/locations-form";

interface SettingsViewProps {
    user: {
        name: string;
        email: string;
        phoneNumber?: string | null;
        image?: string | null;
    };
    organization: {
        name: string;
        metadata?: string | null;
    } | null;
    locations: Array<{
        id: string;
        name: string;
        address: string | null;
        storeId?: string;
    }>;
}

export function SettingsView({ user, organization, locations }: SettingsViewProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "profile";

    const handleTabChange = (value: string) => {
        router.push(`/settings?tab=${value}`);
    };

    return (
        <div className="space-y-6 block pb-16">
            <div className="space-y-0.5">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">
                    Manage your account settings and preferences.
                </p>
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
                        <TabItem value="business" icon={<Building className="w-4 h-4" />} label="Business" />
                        <TabItem value="locations" icon={<MapPin className="w-4 h-4" />} label="Locations" />
                        <TabItem value="team" icon={<Users className="w-4 h-4" />} label="Team" />
                        <TabItem value="billing" icon={<CreditCard className="w-4 h-4" />} label="Billing" />
                        <TabItem value="history" icon={<History className="w-4 h-4" />} label="History" />
                    </TabsList>
                </aside>
                <div className="flex-1 lg:max-w-2xl">
                    <TabsContent value="profile" className="mt-0 space-y-6">
                        <ProfileForm user={user} />
                    </TabsContent>
                    <TabsContent value="business" className="mt-0 space-y-6">
                        <BusinessForm organization={organization} />
                    </TabsContent>
                    <TabsContent value="locations" className="mt-0 space-y-6">
                        <LocationsForm locations={locations} />
                    </TabsContent>
                    <TabsContent value="team" className="mt-0 space-y-6">
                        <PlaceholderSection title="Team Members" description="Invite and manage your team." />
                    </TabsContent>
                    <TabsContent value="billing" className="mt-0 space-y-6">
                        <PlaceholderSection title="Billing" description="Manage your subscription and payment method." />
                    </TabsContent>
                    <TabsContent value="history" className="mt-0 space-y-6">
                        <PlaceholderSection title="History" description="View past invoices and activity." />
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

function PlaceholderSection({ title, description }: { title: string; description: string }) {
    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-slate-100 rounded-lg m-6">
                <p className="text-sm text-muted-foreground">Implementation coming soon.</p>
            </CardContent>
        </Card>
    );
}
