import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { authClient } from "../lib/auth-client";
import { clearStoredActiveOrganizationId } from "../lib/organization-context";
import { workerTheme } from "../lib/theme";

export default function SettingsScreen() {
    const router = useRouter();

    const handleSignOut = async () => {
        try {
            await authClient.signOut();
            await clearStoredActiveOrganizationId();
            router.replace("/(auth)/login");
        } catch (e) {
            console.error("Sign out failed", e);
        }
    };

    return (
        <SafeAreaView style={s.container} edges={["top"]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={workerTheme.colors.foreground} />
                </TouchableOpacity>
                <Text style={s.title}>Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                <SettingsRow icon="person-outline" label="Account information" onPress={() => router.push("/personal-info")} />
                <SettingsRow icon="notifications-outline" label="Notifications" onPress={() => router.push("/preferences")} />
                <SettingsRow icon="calendar-outline" label="My availability" onPress={() => router.push("/availability")} />
                <SettingsRow icon="ribbon-outline" label="Certifications" onPress={() => router.push("/certifications")} />
                <SettingsRow icon="help-circle-outline" label="Contact support" onPress={() => Linking.openURL("mailto:support@workershive.com")} />

                <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut}>
                    <Text style={s.logoutText}>Log out</Text>
                </TouchableOpacity>

                <View style={s.footer}>
                    <View style={s.legalRow}>
                        <TouchableOpacity onPress={() => Linking.openURL("https://workershive.com/privacy")}>
                            <Text style={s.legalLink}>Privacy Policy</Text>
                        </TouchableOpacity>
                        <Text style={s.legalSep}>|</Text>
                        <TouchableOpacity onPress={() => Linking.openURL("https://workershive.com/terms")}>
                            <Text style={s.legalLink}>Terms of Use</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={s.version}>{Constants.expoConfig?.version || "1.0.0"}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function SettingsRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
    return (
        <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.6}>
            <Ionicons name={icon as any} size={20} color={workerTheme.colors.mutedForeground} />
            <Text style={s.rowLabel}>{label}</Text>
            <Ionicons name="chevron-forward" size={18} color={workerTheme.colors.mutedForeground} />
        </TouchableOpacity>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: workerTheme.colors.background },
    header: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: workerTheme.colors.border,
    },
    title: { fontSize: 18, fontWeight: "700", color: workerTheme.colors.foreground },
    row: {
        flexDirection: "row", alignItems: "center", gap: 14,
        paddingVertical: 16, paddingHorizontal: 20,
        borderBottomWidth: 1, borderBottomColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.surface,
    },
    rowLabel: { flex: 1, fontSize: 16, color: workerTheme.colors.foreground },
    logoutBtn: {
        marginTop: 32, marginHorizontal: 20, paddingVertical: 14,
        borderRadius: 10, borderWidth: 1, borderColor: workerTheme.colors.border, alignItems: "center",
        backgroundColor: workerTheme.colors.surface,
    },
    logoutText: { fontSize: 16, fontWeight: "600", color: workerTheme.colors.primary },
    footer: { alignItems: "center", marginTop: 24 },
    legalRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    legalLink: { fontSize: 13, color: workerTheme.colors.mutedForeground },
    legalSep: { color: workerTheme.colors.mutedForeground },
    version: { fontSize: 12, color: workerTheme.colors.mutedForeground, marginTop: 8 },
});
