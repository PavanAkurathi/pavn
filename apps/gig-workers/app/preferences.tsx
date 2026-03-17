import NotificationPreferencesScreen from "../screens/NotificationPreferencesScreen";
import { Stack } from "expo-router";

export default function PreferencesPage() {
    return (
        <>
            <Stack.Screen options={{ title: "Notification Settings" }} />
            <NotificationPreferencesScreen />
        </>
    );
}
