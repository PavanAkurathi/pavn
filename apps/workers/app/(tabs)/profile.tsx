import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { authClient } from "../../lib/auth-client";

// Mock User Data (Replace with real data later)
const USER = {
    name: "John Doe",
    role: "Bartender / Server",
    avatarUrl: null, // Set to a URL string to test image
};

const getInitials = (name: string) => {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
};

export default function ProfileScreen() {
    const router = useRouter();
    const [avatar, setAvatar] = useState<string | null>(USER.avatarUrl);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
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

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <View style={styles.header}>
                <Text style={styles.title}>Profile</Text>
                <TouchableOpacity onPress={() => router.push("/settings")}>
                    <Ionicons name="settings-outline" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={styles.profileCard}>
                    <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{getInitials(USER.name)}</Text>
                            </View>
                        )}
                        <View style={styles.editIconContainer}>
                            <Ionicons name="pencil" size={12} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <View style={styles.profileInfo}>
                        <Text style={styles.name}>{USER.name}</Text>
                        <Text style={styles.role}>{USER.role}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/personal-info")}>
                        <Ionicons name="person-outline" size={20} color="#888" />
                        <Text style={styles.menuItemText}>Personal Information</Text>
                        <Ionicons name="chevron-forward" size={16} color="#666" />
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/notifications")}>
                        <Ionicons name="notifications-outline" size={20} color="#888" />
                        <Text style={styles.menuItemText}>Notification Settings</Text>
                        <Ionicons name="chevron-forward" size={16} color="#666" />
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/certifications")}>
                        <Ionicons name="ribbon-outline" size={20} color="#888" />
                        <Text style={styles.menuItemText}>Certifications</Text>
                        <Ionicons name="chevron-forward" size={16} color="#666" />
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/availability")}>
                        <Ionicons name="calendar-outline" size={20} color="#888" />
                        <Text style={styles.menuItemText}>Availability</Text>
                        <Ionicons name="chevron-forward" size={16} color="#666" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#fff",
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    profileCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111",
        padding: 16,
        borderRadius: 12,
        marginBottom: 32,
    },
    avatarContainer: {
        position: "relative",
        marginRight: 16,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#222",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#333",
    },
    avatarImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: "#333",
    },
    editIconContainer: {
        position: "absolute",
        bottom: 0,
        right: 0,
        backgroundColor: "#007AFF",
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#111",
    },
    avatarText: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "600",
    },
    profileInfo: {
        flex: 1,
    },
    name: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 4,
    },
    role: {
        color: "#888",
        fontSize: 14,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        color: "#666",
        fontSize: 12,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 8,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
    },
    menuItemText: {
        flex: 1,
        color: "#fff",
        fontSize: 16,
        marginLeft: 16,
    },
    divider: {
        height: 1,
        backgroundColor: "#222",
        marginLeft: 36,
    },
    signOutButton: {
        paddingVertical: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#333",
        borderRadius: 8,
    },
    signOutText: {
        color: "#FF5252",
        fontSize: 16,
        fontWeight: "600",
    },
});
