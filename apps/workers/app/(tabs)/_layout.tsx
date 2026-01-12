import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#000",
                    borderTopColor: "#333",
                    height: 60 + insets.bottom, // Base height + safe area
                    paddingBottom: insets.bottom + 4, // Safe area + slight padding
                    paddingTop: 8,
                },
                tabBarActiveTintColor: "#fff",
                tabBarInactiveTintColor: "#666",
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Schedule",
                    tabBarLabel: "Schedule",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="calendar-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarLabel: "Profile",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
