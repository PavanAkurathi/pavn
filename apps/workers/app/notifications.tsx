import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function NotificationSettingsScreen() {
    const router = useRouter();

    // Mock initial state
    const [settings, setSettings] = useState({
        newSchedule: true,
        shiftChanges: true,
        remindersPush: true,
        remindersSMS: false,
        openShifts: true,
        teamAnnouncements: true,
    });

    const toggleSwitch = (key: string) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key as keyof typeof settings] }));
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>Notification Settings</Text>
            </View>

            <ScrollView style={styles.content}>

                {/* Shift Updates */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>SHIFT UPDATES</Text>
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>New Schedule Published</Text>
                            <Text style={styles.rowSubtitle}>Get notified when a new schedule is live.</Text>
                        </View>
                        <Switch
                            trackColor={{ false: "#333", true: "#fff" }}
                            thumbColor={settings.newSchedule ? "#000" : "#888"}
                            ios_backgroundColor="#333"
                            onValueChange={() => toggleSwitch("newSchedule")}
                            value={settings.newSchedule}
                        />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>Shift Changes</Text>
                            <Text style={styles.rowSubtitle}>Alerts for modified or cancelled shifts.</Text>
                        </View>
                        <Switch
                            trackColor={{ false: "#333", true: "#fff" }}
                            thumbColor={settings.shiftChanges ? "#000" : "#888"}
                            ios_backgroundColor="#333"
                            onValueChange={() => toggleSwitch("shiftChanges")}
                            value={settings.shiftChanges}
                        />
                    </View>
                </View>

                {/* Reminders */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>REMINDERS</Text>
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>Push Notifications</Text>
                            <Text style={styles.rowSubtitle}>Remind me 1 hour before shift starts.</Text>
                        </View>
                        <Switch
                            trackColor={{ false: "#333", true: "#fff" }}
                            thumbColor={settings.remindersPush ? "#000" : "#888"}
                            ios_backgroundColor="#333"
                            onValueChange={() => toggleSwitch("remindersPush")}
                            value={settings.remindersPush}
                        />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>SMS Reminders</Text>
                            <Text style={styles.rowSubtitle}>Receive text message reminders.</Text>
                        </View>
                        <Switch
                            trackColor={{ false: "#333", true: "#fff" }}
                            thumbColor={settings.remindersSMS ? "#000" : "#888"}
                            ios_backgroundColor="#333"
                            onValueChange={() => toggleSwitch("remindersSMS")}
                            value={settings.remindersSMS}
                        />
                    </View>
                </View>

                {/* Opportunities */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>OPPORTUNITIES</Text>
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>Open Shifts</Text>
                            <Text style={styles.rowSubtitle}>Notify when shifts become available to pick up.</Text>
                        </View>
                        <Switch
                            trackColor={{ false: "#333", true: "#fff" }}
                            thumbColor={settings.openShifts ? "#000" : "#888"}
                            ios_backgroundColor="#333"
                            onValueChange={() => toggleSwitch("openShifts")}
                            value={settings.openShifts}
                        />
                    </View>
                </View>

            </ScrollView>
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
        alignItems: "center",
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#222",
    },
    backButton: {
        marginRight: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#fff",
    },
    content: {
        flex: 1,
    },
    section: {
        marginTop: 24,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: "600",
        color: "#666",
        paddingHorizontal: 16,
        marginBottom: 8,
        letterSpacing: 1,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: "#111",
    },
    rowText: {
        flex: 1,
        marginRight: 16,
    },
    rowTitle: {
        fontSize: 16,
        color: "#fff",
        fontWeight: "500",
    },
    rowSubtitle: {
        fontSize: 13,
        color: "#888",
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: "#222",
        marginLeft: 16,
    },
});
