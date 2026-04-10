import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Switch } from "heroui-native/switch";

import { PageHeader } from "../../../components/ui/page-header";
import { Screen } from "../../../components/ui/screen";
import { SectionCard } from "../../../components/ui/section-card";
import { SectionTitle } from "../../../components/ui/section-title";

type NotificationSettings = {
    scheduleUpdates: boolean;
    shiftChanges: boolean;
    arrivalBanners: boolean;
    conflictAlerts: boolean;
    preShiftReminders: boolean;
    teamAnnouncements: boolean;
};

type NotificationSettingKey = keyof NotificationSettings;

export default function NotificationSettingsScreen() {
    const router = useRouter();
    const [settings, setSettings] = useState<NotificationSettings>({
        scheduleUpdates: true,
        shiftChanges: true,
        arrivalBanners: true,
        conflictAlerts: true,
        preShiftReminders: true,
        teamAnnouncements: true,
    });

    const toggle = (key: NotificationSettingKey) => {
        setSettings((current) => ({ ...current, [key]: !current[key] }));
    };

    return (
        <Screen>
            <PageHeader title="Notifications" showBack onBack={() => router.back()} />

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}>
                <Text className="text-sm leading-6 text-muted">
                    Arrival, conflict, and shift reminders are handled in the app. SMS stays reserved for sign-in verification.
                </Text>

                <Section
                    title="Shift updates"
                    rows={[
                        {
                            key: "scheduleUpdates",
                            title: "Schedule published",
                            subtitle: "See when a new schedule is ready.",
                        },
                        {
                            key: "shiftChanges",
                            title: "Shift changes",
                            subtitle: "Get alerted when a shift is modified or cancelled.",
                        },
                    ]}
                    settings={settings}
                    toggle={toggle}
                />

                <Section
                    title="On-site alerts"
                    rows={[
                        {
                            key: "arrivalBanners",
                            title: "Arrival banner",
                            subtitle: "Show an in-app alert when you arrive at the venue and can clock in.",
                        },
                        {
                            key: "conflictAlerts",
                            title: "Conflict alerts",
                            subtitle: "Notify you when shifts overlap so you can resolve them.",
                        },
                    ]}
                    settings={settings}
                    toggle={toggle}
                />

                <Section
                    title="Reminders"
                    rows={[
                        {
                            key: "preShiftReminders",
                            title: "Pre-shift reminders",
                            subtitle: "Receive app reminders before your shift starts.",
                        },
                        {
                            key: "teamAnnouncements",
                            title: "Team announcements",
                            subtitle: "See important updates from your organizations.",
                        },
                    ]}
                    settings={settings}
                    toggle={toggle}
                />
            </ScrollView>
        </Screen>
    );
}

function Section({
    title,
    rows,
    settings,
    toggle,
}: {
    title: string;
    rows: Array<{ key: NotificationSettingKey; title: string; subtitle: string }>;
    settings: NotificationSettings;
    toggle: (key: NotificationSettingKey) => void;
}) {
    return (
        <View className="gap-3">
            <SectionTitle label={title} />
            <SectionCard className="gap-0 p-0">
                {rows.map((row, index) => (
                    <View
                        key={row.key}
                        className={[
                            "flex-row items-center gap-4 px-5 py-4",
                            index < rows.length - 1 ? "border-b border-border" : "",
                        ].join(" ")}
                    >
                        <View className="flex-1 gap-1">
                            <Text className="text-base font-medium text-foreground">{row.title}</Text>
                            <Text className="text-sm leading-5 text-muted">{row.subtitle}</Text>
                        </View>
                        <Switch
                            isSelected={settings[row.key]}
                            onSelectedChange={() => toggle(row.key)}
                        />
                    </View>
                ))}
            </SectionCard>
        </View>
    );
}
