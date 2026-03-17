import { useEffect, useState } from "react";
import {
    View,
    StyleSheet,
    ScrollView,
    Switch,
    ActivityIndicator,
    Alert,
    Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, WorkerPreferences } from "../lib/api";
import { workerTheme } from "../lib/theme";

export default function NotificationPreferencesScreen() {
    const [loading, setLoading] = useState(true);
    const [preferences, setPreferences] = useState<WorkerPreferences | null>(null);

    useEffect(() => {
        void loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            const data = await api.preferences.get();
            setPreferences(data);
        } catch (error) {
            Alert.alert("Error", "Failed to load preferences");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const togglePreference = async (key: keyof WorkerPreferences) => {
        if (!preferences) {
            return;
        }

        const oldValue = preferences[key];
        const newValue = !oldValue;

        setPreferences({ ...preferences, [key]: newValue });

        try {
            await api.preferences.update({ [key]: newValue });
        } catch (error) {
            setPreferences({ ...preferences, [key]: oldValue });
            Alert.alert("Error", "Failed to update setting");
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={s.center}>
                <ActivityIndicator size="large" color={workerTheme.colors.primary} />
            </SafeAreaView>
        );
    }

    if (!preferences) {
        return null;
    }

    const renderToggle = (
        label: string,
        key: keyof WorkerPreferences,
        description?: string,
    ) => (
        <View style={s.row} key={key}>
            <View style={s.textContainer}>
                <Text style={s.label}>{label}</Text>
                {description ? <Text style={s.description}>{description}</Text> : null}
            </View>
            <Switch
                value={Boolean(preferences[key])}
                onValueChange={() => togglePreference(key)}
                thumbColor={workerTheme.colors.white}
                trackColor={{
                    false: workerTheme.colors.border,
                    true: workerTheme.colors.primary,
                }}
                ios_backgroundColor={workerTheme.colors.border}
            />
        </View>
    );

    return (
        <SafeAreaView style={s.container} edges={["bottom"]}>
            <ScrollView contentContainerStyle={s.content}>
                <Text style={s.header}>Notification preferences</Text>
                <Text style={s.intro}>
                    Shift reminders, schedule alerts, and arrival nudges are handled in the app. SMS remains reserved for authentication.
                </Text>

                <View style={s.section}>
                    <Text style={s.sectionHeader}>Reminders</Text>
                    <View style={s.sectionCard}>
                        {renderToggle(
                            "Night before shift",
                            "nightBeforeEnabled",
                            "Get a reminder the night before your shift.",
                        )}
                        {renderToggle(
                            "1 hour before",
                            "sixtyMinEnabled",
                            "Get a heads-up 60 minutes before start.",
                        )}
                        {renderToggle(
                            "15 minutes before",
                            "fifteenMinEnabled",
                            "Get a final warning to head out.",
                        )}
                    </View>
                </View>

                <View style={s.section}>
                    <Text style={s.sectionHeader}>Alerts</Text>
                    <View style={s.sectionCard}>
                        {renderToggle(
                            "Shift starting",
                            "shiftStartEnabled",
                            "Notify when your shift technically begins.",
                        )}
                        {renderToggle(
                            "Late warning",
                            "lateWarningEnabled",
                            "Alert if you have not clocked in on time.",
                        )}
                        {renderToggle(
                            "Arrival banner",
                            "geofenceAlertsEnabled",
                            "Show a clock-in alert when you arrive on site.",
                        )}
                    </View>
                </View>

                <View style={s.section}>
                    <Text style={s.sectionHeader}>Quiet hours</Text>
                    <View style={s.sectionCard}>
                        {renderToggle(
                            "Enable quiet hours",
                            "quietHoursEnabled",
                            "Suppress non-urgent app notifications during set times.",
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: workerTheme.colors.background,
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: workerTheme.colors.background,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    header: {
        fontSize: 28,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
        marginTop: 20,
        marginBottom: 10,
    },
    intro: {
        fontSize: 14,
        lineHeight: 21,
        color: workerTheme.colors.mutedForeground,
        marginBottom: 24,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: "700",
        color: workerTheme.colors.mutedForeground,
        marginBottom: 10,
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    sectionCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.surface,
        overflow: "hidden",
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: workerTheme.colors.border,
    },
    textContainer: {
        flex: 1,
        paddingRight: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: "600",
        color: workerTheme.colors.foreground,
        marginBottom: 4,
    },
    description: {
        fontSize: 14,
        lineHeight: 19,
        color: workerTheme.colors.mutedForeground,
    },
});
