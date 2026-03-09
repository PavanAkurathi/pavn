import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { workerTheme } from "../lib/theme";

export default function CertificationsScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={s.container} edges={["top"]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.iconButton}>
                    <Ionicons name="arrow-back" size={24} color={workerTheme.colors.foreground} />
                </TouchableOpacity>
                <Text style={s.title}>Certifications</Text>
                <View style={{ width: 32 }} />
            </View>

            <View style={s.content}>
                <View style={s.heroIcon}>
                    <Ionicons name="ribbon-outline" size={28} color={workerTheme.colors.secondary} />
                </View>
                <Text style={s.heading}>Not available in this build</Text>
                <Text style={s.body}>
                    Certification upload and tracking are not part of the current launch scope for the worker app.
                </Text>
                <TouchableOpacity
                    style={s.action}
                    onPress={() => Linking.openURL("mailto:support@workershive.com")}
                >
                    <Text style={s.actionText}>Contact support</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: workerTheme.colors.background },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: workerTheme.colors.border,
    },
    iconButton: { padding: 4 },
    title: { fontSize: 18, fontWeight: "700", color: workerTheme.colors.foreground },
    content: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
    },
    heroIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: workerTheme.colors.secondarySoft,
        marginBottom: 20,
    },
    heading: {
        fontSize: 22,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
        textAlign: "center",
    },
    body: {
        marginTop: 10,
        fontSize: 15,
        lineHeight: 22,
        color: workerTheme.colors.mutedForeground,
        textAlign: "center",
    },
    action: {
        marginTop: 24,
        minHeight: 48,
        paddingHorizontal: 20,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: workerTheme.colors.primary,
    },
    actionText: {
        fontSize: 15,
        fontWeight: "700",
        color: workerTheme.colors.white,
    },
});
