import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";

import { Button } from "heroui-native/button";
import { Chip } from "heroui-native/chip";

import { LoadingScreen } from "../../components/ui/loading-screen";
import { MenuList } from "../../components/ui/menu-list";
import { PageHeader } from "../../components/ui/page-header";
import { ProfileAvatar } from "../../components/ui/profile-avatar";
import { Screen } from "../../components/ui/screen";
import { SectionCard } from "../../components/ui/section-card";
import { SectionTitle } from "../../components/ui/section-title";
import { authClient } from "../../lib/auth-client";
import { api, WorkerOrg } from "../../lib/api";
import { clearStoredActiveOrganizationId } from "../../lib/organization-context";
import { Icon } from "../../components/ui/icon";

export default function ProfileScreen() {
    const router = useRouter();
    const [user, setUser] = useState<{ id: string; name: string; email: string; image?: string } | null>(null);
    const [orgs, setOrgs] = useState<WorkerOrg[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const session = await authClient.getSession();
            if (session.data?.user) {
                setUser({
                    id: session.data.user.id,
                    name: session.data.user.name,
                    email: session.data.user.email,
                    image: session.data.user.image || undefined,
                });
            }

            const orgResult = await api.worker.getOrganizations();
            setOrgs(orgResult.organizations);
        } catch (error) {
            console.error("Failed to load profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const showUnavailable = (feature: string) => {
        Alert.alert("Unavailable", `${feature} is not available in this build yet.`);
    };

    const handleSignOut = async () => {
        try {
            await authClient.signOut();
            await clearStoredActiveOrganizationId();
            router.replace("/(auth)/login");
        } catch (error) {
            console.error("Sign out failed", error);
        }
    };

    if (loading) {
        return <LoadingScreen label="Loading your profile" />;
    }

    return (
        <Screen>
            <PageHeader
                title="Profile"
                actions={[
                    {
                        icon: "settings-outline",
                        label: "Settings",
                        onPress: () => router.push("/settings"),
                    },
                ]}
            />

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}>
                <SectionCard className="items-center">
                    <ProfileAvatar name={user?.name || "Worker"} image={user?.image} />
                    <View className="items-center gap-1">
                        <Text className="text-2xl font-semibold text-foreground">{user?.name || "Worker"}</Text>
                        <Text className="text-sm text-muted">{user?.email || ""}</Text>
                    </View>
                    <Button variant="secondary" onPress={() => showUnavailable("Profile photo upload")}>
                        <Button.Label>Edit photo</Button.Label>
                    </Button>
                </SectionCard>

                {orgs.length > 0 ? (
                    <View className="gap-3">
                        <SectionTitle label="My organizations" />
                        <SectionCard>
                            {orgs.map((org) => (
                                <View key={org.id} className="flex-row items-center gap-3 rounded-[20px] bg-default px-4 py-3">
                                    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-surface">
                                        <Icon name="business-outline" size={18} className="text-secondary" />
                                    </View>
                                    <View className="flex-1 gap-1">
                                        <Text className="text-sm font-medium text-foreground">{org.name}</Text>
                                        <Text className="text-xs capitalize text-muted">{org.role}</Text>
                                    </View>
                                    <Chip variant="soft" color="default" size="sm">
                                        <Chip.Label>{org.role}</Chip.Label>
                                    </Chip>
                                </View>
                            ))}
                        </SectionCard>
                    </View>
                ) : null}

                <View className="gap-3">
                    <SectionTitle label="Workspace" />
                    <MenuList
                        items={[
                            {
                                icon: "person-outline",
                                title: "Personal info",
                                description: "Review your name, email, and phone number.",
                                onPress: () => router.push("/personal-info"),
                            },
                            {
                                icon: "calendar-outline",
                                title: "My availability",
                                description: "Manage blocked days and weekly coverage.",
                                onPress: () => router.push("/availability"),
                            },
                            {
                                icon: "notifications-outline",
                                title: "Notification preferences",
                                description: "Control shift reminders and in-app alerts.",
                                onPress: () => router.push("/preferences"),
                            },
                            {
                                icon: "document-text-outline",
                                title: "Adjustment requests",
                                description: "Review past time corrections and manager follow-up.",
                                onPress: () => router.push("/notifications"),
                            },
                        ]}
                    />
                </View>

                <Button variant="secondary" onPress={handleSignOut}>
                    <Button.Label>Log out</Button.Label>
                </Button>

                <Text className="text-center text-xs text-muted">
                    Workers Hive v{Constants.expoConfig?.version || "1.0.0"}
                </Text>
            </ScrollView>
        </Screen>
    );
}
