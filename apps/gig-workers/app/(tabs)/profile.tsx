import { useState, useEffect } from "react";
import { Alert, View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";

import { authClient } from "../../lib/auth-client";
import { api, WorkerOrg } from "../../lib/api";
import { clearStoredActiveOrganizationId } from "../../lib/organization-context";
import { workerTheme } from "../../lib/theme";

const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

export default function ProfileScreen() {
    const router = useRouter();
    const [user, setUser] = useState<{ id: string; name: string; email: string; image?: string } | null>(null);
    const [orgs, setOrgs] = useState<WorkerOrg[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProfile();
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
        } catch (err) {
            console.error("Failed to load profile:", err);
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
        return (
            <SafeAreaView style={styles.container} edges={["top"]}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={workerTheme.colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile</Text>
                <TouchableOpacity onPress={() => router.push("/settings")}>
                    <Ionicons name="settings-outline" size={22} color={workerTheme.colors.foreground} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Avatar */}
                <TouchableOpacity style={styles.avatarContainer} onPress={() => showUnavailable("Profile photo upload")}>
                    {user?.image ? (
                        <Image source={{ uri: user.image }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.initials}>{getInitials(user?.name || "?")}</Text>
                        </View>
                    )}
                    <View style={styles.cameraIcon}>
                        <Ionicons name="camera" size={14} color={workerTheme.colors.white} />
                    </View>
                </TouchableOpacity>

                <Text style={styles.userName}>{user?.name || "Worker"}</Text>
                <Text style={styles.userEmail}>{user?.email || ""}</Text>

                {/* Organizations */}
                {orgs.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>My organizations</Text>
                        {orgs.map(org => (
                            <View key={org.id} style={styles.orgRow}>
                                <View style={styles.orgIcon}>
                                    <Ionicons name="business-outline" size={18} color={workerTheme.colors.secondary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.orgName}>{org.name}</Text>
                                    <Text style={styles.orgRole}>{org.role}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Menu Items */}
                <View style={styles.section}>
                    <MenuItem icon="person-outline" label="Personal info" onPress={() => router.push("/personal-info")} />
                    <MenuItem icon="calendar-outline" label="My availability" onPress={() => router.push("/availability")} />
                    <MenuItem icon="notifications-outline" label="Notification preferences" onPress={() => router.push("/preferences")} />
                    <MenuItem icon="time-outline" label="Adjustment requests" onPress={() => router.push("/notifications")} />
                </View>

                {/* Sign Out */}
                <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                    <Text style={styles.signOutText}>Log out</Text>
                </TouchableOpacity>

                {/* Footer */}
                <Text style={styles.version}>
                    WorkersHive v{Constants.expoConfig?.version || "1.0.0"}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

function MenuItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
            <Ionicons name={icon as any} size={20} color={workerTheme.colors.mutedForeground} />
            <Text style={styles.menuLabel}>{label}</Text>
            <Ionicons name="chevron-forward" size={18} color={workerTheme.colors.mutedForeground} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: workerTheme.colors.background },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", paddingHorizontal: 20, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: workerTheme.colors.border,
    },
    headerTitle: { fontSize: 26, fontWeight: "700", color: workerTheme.colors.foreground },
    scroll: { paddingBottom: 40, alignItems: "center" },

    // Avatar
    avatarContainer: { marginTop: 20, marginBottom: 12 },
    avatar: { width: 96, height: 96, borderRadius: 48 },
    avatarPlaceholder: {
        width: 96, height: 96, borderRadius: 48,
        backgroundColor: workerTheme.colors.surfaceMuted, justifyContent: "center", alignItems: "center",
        borderWidth: 1, borderColor: workerTheme.colors.border,
    },
    initials: { fontSize: 32, fontWeight: "700", color: workerTheme.colors.foreground },
    cameraIcon: {
        position: "absolute", bottom: 0, right: 0,
        backgroundColor: workerTheme.colors.primary, borderRadius: 14, width: 28, height: 28,
        justifyContent: "center", alignItems: "center",
        borderWidth: 2, borderColor: workerTheme.colors.background,
    },
    userName: { fontSize: 22, fontWeight: "700", color: workerTheme.colors.foreground, marginBottom: 4 },
    userEmail: { fontSize: 14, color: workerTheme.colors.mutedForeground, marginBottom: 20 },

    // Orgs
    section: {
        width: "100%", paddingHorizontal: 20, marginTop: 16,
    },
    sectionLabel: {
        fontSize: 13, fontWeight: "600", color: workerTheme.colors.mutedForeground,
        textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
    },
    orgRow: {
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: workerTheme.colors.border,
    },
    orgIcon: {
        width: 36, height: 36, borderRadius: 8, backgroundColor: workerTheme.colors.secondarySoft,
        justifyContent: "center", alignItems: "center",
    },
    orgName: { fontSize: 15, fontWeight: "500", color: workerTheme.colors.foreground },
    orgRole: { fontSize: 12, color: workerTheme.colors.mutedForeground, textTransform: "capitalize" },

    // Menu
    menuItem: {
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: workerTheme.colors.border,
    },
    menuLabel: { flex: 1, fontSize: 15, color: workerTheme.colors.foreground },

    // Sign Out
    signOutBtn: {
        marginTop: 24, marginHorizontal: 20, paddingVertical: 14,
        borderRadius: 10, borderWidth: 1, borderColor: workerTheme.colors.border,
        alignItems: "center", width: "90%",
        backgroundColor: workerTheme.colors.surface,
    },
    signOutText: { fontSize: 15, fontWeight: "600", color: workerTheme.colors.primary },

    // Footer
    version: { marginTop: 16, fontSize: 12, color: workerTheme.colors.mutedForeground },
});
