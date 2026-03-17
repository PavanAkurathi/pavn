import { useState, type ReactNode } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { workerTheme } from "../lib/theme";

export default function NotificationSettingsScreen() {
    const router = useRouter();
    const [settings, setSettings] = useState({
        scheduleUpdates: true,
        shiftChanges: true,
        arrivalBanners: true,
        conflictAlerts: true,
        preShiftReminders: true,
        teamAnnouncements: true,
    });

    const toggle = (key: keyof typeof settings) => {
        setSettings((current) => ({ ...current, [key]: !current[key] }));
    };

    return (
        <SafeAreaView style={s.container} edges={["top"]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
                    <Ionicons name="arrow-back" size={24} color={workerTheme.colors.foreground} />
                </TouchableOpacity>
                <Text style={s.title}>Notifications</Text>
            </View>

            <ScrollView contentContainerStyle={s.content}>
                <Text style={s.intro}>
                    Arrival, conflict, and shift reminders are handled in the app. SMS stays reserved for sign-in verification.
                </Text>

                <Section title="Shift updates">
                    <ToggleRow
                        title="Schedule published"
                        subtitle="See when a new schedule is ready."
                        value={settings.scheduleUpdates}
                        onValueChange={() => toggle("scheduleUpdates")}
                    />
                    <ToggleRow
                        title="Shift changes"
                        subtitle="Get alerted when a shift is modified or cancelled."
                        value={settings.shiftChanges}
                        onValueChange={() => toggle("shiftChanges")}
                    />
                </Section>

                <Section title="On-site alerts">
                    <ToggleRow
                        title="Arrival banner"
                        subtitle="Show an in-app alert when you arrive at the venue and can clock in."
                        value={settings.arrivalBanners}
                        onValueChange={() => toggle("arrivalBanners")}
                    />
                    <ToggleRow
                        title="Conflict alerts"
                        subtitle="Notify you when shifts overlap so you can resolve them."
                        value={settings.conflictAlerts}
                        onValueChange={() => toggle("conflictAlerts")}
                    />
                </Section>

                <Section title="Reminders">
                    <ToggleRow
                        title="Pre-shift reminders"
                        subtitle="Receive app reminders before your shift starts."
                        value={settings.preShiftReminders}
                        onValueChange={() => toggle("preShiftReminders")}
                    />
                    <ToggleRow
                        title="Team announcements"
                        subtitle="See important updates from your organizations."
                        value={settings.teamAnnouncements}
                        onValueChange={() => toggle("teamAnnouncements")}
                    />
                </Section>
            </ScrollView>
        </SafeAreaView>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <View style={s.section}>
            <Text style={s.sectionTitle}>{title}</Text>
            <View style={s.sectionBody}>{children}</View>
        </View>
    );
}

function ToggleRow({
    title,
    subtitle,
    value,
    onValueChange,
}: {
    title: string;
    subtitle: string;
    value: boolean;
    onValueChange: () => void;
}) {
    return (
        <View style={s.row}>
            <View style={s.rowText}>
                <Text style={s.rowTitle}>{title}</Text>
                <Text style={s.rowSubtitle}>{subtitle}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                thumbColor={workerTheme.colors.white}
                trackColor={{
                    false: workerTheme.colors.border,
                    true: workerTheme.colors.primary,
                }}
                ios_backgroundColor={workerTheme.colors.border}
            />
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: workerTheme.colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: workerTheme.colors.border,
    },
    backButton: {
        marginLeft: -4,
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    intro: {
        fontSize: 14,
        lineHeight: 21,
        color: workerTheme.colors.mutedForeground,
        marginBottom: 20,
    },
    section: {
        marginBottom: 22,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1,
        color: workerTheme.colors.mutedForeground,
        marginBottom: 10,
    },
    sectionBody: {
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
        borderRadius: 18,
        backgroundColor: workerTheme.colors.surface,
        overflow: "hidden",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: workerTheme.colors.border,
    },
    rowText: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: workerTheme.colors.foreground,
    },
    rowSubtitle: {
        marginTop: 4,
        fontSize: 13,
        lineHeight: 18,
        color: workerTheme.colors.mutedForeground,
    },
});
