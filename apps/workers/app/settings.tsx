import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { authClient } from "../lib/auth-client";

export default function SettingsScreen() {
    const router = useRouter();

    const handleSignOut = async () => {
        try {
            await authClient.signOut();
            router.replace("/(auth)/login");
        } catch (e) {
            console.error("Sign out failed", e);
        }
    };

    return (
        <SafeAreaView style={s.container} edges={["top"]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
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
            <Ionicons name={icon as any} size={20} color="#999" />
            <Text style={s.rowLabel}>{label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#444" />
        </TouchableOpacity>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0A0A0A" },
    header: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1A1A1A",
    },
    title: { fontSize: 18, fontWeight: "700", color: "#fff" },
    row: {
        flexDirection: "row", alignItems: "center", gap: 14,
        paddingVertical: 16, paddingHorizontal: 20,
        borderBottomWidth: 1, borderBottomColor: "#141414",
    },
    rowLabel: { flex: 1, fontSize: 16, color: "#fff" },
    logoutBtn: {
        marginTop: 32, marginHorizontal: 20, paddingVertical: 14,
        borderRadius: 10, borderWidth: 1, borderColor: "#333", alignItems: "center",
    },
    logoutText: { fontSize: 16, fontWeight: "600", color: "#EF4444" },
    footer: { alignItems: "center", marginTop: 24 },
    legalRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    legalLink: { fontSize: 13, color: "#666" },
    legalSep: { color: "#444" },
    version: { fontSize: 12, color: "#444", marginTop: 8 },
});
