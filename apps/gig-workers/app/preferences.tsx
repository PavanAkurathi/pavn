import NotificationSettingsScreen from "./_components/preferences/notification-settings-screen";
import { Stack } from "expo-router";

export default function PreferencesPage() {
    return (
        <>
            <Stack.Screen options={{ title: "Notification Settings" }} />
            <NotificationSettingsScreen />
        </>
    );
}
