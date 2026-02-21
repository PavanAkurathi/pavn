import { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";

import { authClient } from "../../lib/auth-client";
import { api, WorkerOrg } from "../../lib/api";

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

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]?.uri) {
            // TODO: Upload image to storage, then update profile
            // For now just update local state
            setUser(prev => prev ? { ...prev, image: result.assets[0].uri } : prev);
        }
    };

    const handleSignOut = async () => {
        try {
            await authClient.signOut();
            router.replace("/(auth)/login");
        } catch (error) {
            console.error("Sign out failed", error);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={["top"]}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile</Text>
                <TouchableOpacity onPress={() => router.push("/settings")}>
                    <Ionicons name="settings-outline" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Avatar */}
                <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
                    {user?.image ? (
                        <Image source={{ uri: user.image }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.initials}>{getInitials(user?.name || "?")}</Text>
                        </View>
                    )}
                    <View style={styles.cameraIcon}>
                        <Ionicons name="camera" size={14} color="#fff" />
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
                                    <Ionicons name="business-outline" size={18} color="#3B82F6" />
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
                    <MenuItem icon="document-text-outline" label="Certifications" onPress={() => router.push("/certifications")} />
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
            <Ionicons name={icon as any} size={20} color="#999" />
            <Text style={styles.menuLabel}>{label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#555" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0A0A0A" },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", paddingHorizontal: 20, paddingVertical: 12,
    },
    headerTitle: { fontSize: 26, fontWeight: "700", color: "#fff" },
    scroll: { paddingBottom: 40, alignItems: "center" },

    // Avatar
    avatarContainer: { marginTop: 20, marginBottom: 12 },
    avatar: { width: 96, height: 96, borderRadius: 48 },
    avatarPlaceholder: {
        width: 96, height: 96, borderRadius: 48,
        backgroundColor: "#2A2A2A", justifyContent: "center", alignItems: "center",
    },
    initials: { fontSize: 32, fontWeight: "700", color: "#fff" },
    cameraIcon: {
        position: "absolute", bottom: 0, right: 0,
        backgroundColor: "#3B82F6", borderRadius: 14, width: 28, height: 28,
        justifyContent: "center", alignItems: "center",
        borderWidth: 2, borderColor: "#0A0A0A",
    },
    userName: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 4 },
    userEmail: { fontSize: 14, color: "#888", marginBottom: 20 },

    // Orgs
    section: {
        width: "100%", paddingHorizontal: 20, marginTop: 16,
    },
    sectionLabel: {
        fontSize: 13, fontWeight: "600", color: "#666",
        textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
    },
    orgRow: {
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1A1A1A",
    },
    orgIcon: {
        width: 36, height: 36, borderRadius: 8, backgroundColor: "#1A2332",
        justifyContent: "center", alignItems: "center",
    },
    orgName: { fontSize: 15, fontWeight: "500", color: "#fff" },
    orgRole: { fontSize: 12, color: "#888", textTransform: "capitalize" },

    // Menu
    menuItem: {
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1A1A1A",
    },
    menuLabel: { flex: 1, fontSize: 15, color: "#fff" },

    // Sign Out
    signOutBtn: {
        marginTop: 24, marginHorizontal: 20, paddingVertical: 14,
        borderRadius: 10, borderWidth: 1, borderColor: "#333",
        alignItems: "center", width: "90%",
    },
    signOutText: { fontSize: 15, fontWeight: "600", color: "#EF4444" },

    // Footer
    version: { marginTop: 16, fontSize: 12, color: "#444" },
});
