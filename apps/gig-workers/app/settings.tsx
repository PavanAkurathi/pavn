import { Linking, ScrollView, Text, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

import { Button } from "heroui-native/button";

import { MenuList } from "../components/ui/menu-list";
import { PageHeader } from "../components/ui/page-header";
import { Screen } from "../components/ui/screen";
import { SectionTitle } from "../components/ui/section-title";
import { authClient } from "../lib/auth-client";
import { clearStoredActiveOrganizationId } from "../lib/organization-context";

export default function SettingsScreen() {
    const router = useRouter();

    const handleSignOut = async () => {
        try {
            await authClient.signOut();
            await clearStoredActiveOrganizationId();
            router.replace("/(auth)/login");
        } catch (error) {
            console.error("Sign out failed", error);
        }
    };

    return (
        <Screen>
            <PageHeader title="Settings" showBack />

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 18 }}>
                <View className="gap-3">
                    <SectionTitle label="Account" />
                    <MenuList
                        items={[
                            {
                                icon: "person-outline",
                                title: "Account information",
                                description: "Update your name and review your sign-in details.",
                                onPress: () => router.push("/personal-info"),
                            },
                            {
                                icon: "notifications-outline",
                                title: "Notifications",
                                description: "Control in-app alerts and reminders.",
                                onPress: () => router.push("/preferences"),
                            },
                            {
                                icon: "calendar-outline",
                                title: "My availability",
                                description: "Review your weekly schedule coverage and block days.",
                                onPress: () => router.push("/availability"),
                            },
                            {
                                icon: "help-circle-outline",
                                title: "Contact support",
                                description: "Email the Workers Hive team for help.",
                                onPress: () => Linking.openURL("mailto:support@workershive.com"),
                            },
                        ]}
                    />
                </View>

                <View className="gap-4">
                    <Button variant="secondary" onPress={handleSignOut}>
                        <Button.Label>Log out</Button.Label>
                    </Button>

                    <View className="items-center gap-2 px-3">
                        <View className="flex-row items-center gap-2">
                            <Text className="text-sm text-muted" onPress={() => Linking.openURL("https://workershive.com/privacy")}>
                                Privacy Policy
                            </Text>
                            <Text className="text-sm text-muted">|</Text>
                            <Text className="text-sm text-muted" onPress={() => Linking.openURL("https://workershive.com/terms")}>
                                Terms of Use
                            </Text>
                        </View>
                        <Text className="text-xs text-muted">
                            Workers Hive v{Constants.expoConfig?.version || "1.0.0"}
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </Screen>
    );
}
