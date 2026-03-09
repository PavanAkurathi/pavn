import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { workerTheme } from "../../lib/theme";

export default function TabsLayout() {
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: workerTheme.colors.background,
                    borderTopColor: workerTheme.colors.border,
                    borderTopWidth: 1,
                    height: 56 + insets.bottom,
                    paddingBottom: insets.bottom + 2,
                    paddingTop: 6,
                },
                tabBarActiveTintColor: workerTheme.colors.primary,
                tabBarInactiveTintColor: workerTheme.colors.mutedForeground,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: "500",
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Shifts",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="calendar-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
