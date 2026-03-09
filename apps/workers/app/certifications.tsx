import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { workerTheme } from "../lib/theme";

const CERTIFICATIONS = [
    {
        id: "1",
        name: "ServSafe Alcohol",
        issuer: "National Restaurant Association",
        expires: "2025-08-15",
        status: "valid",
    },
    {
        id: "2",
        name: "Food Handler",
        issuer: "ServSafe",
        expires: "2023-12-01",
        status: "expired",
    },
];

function StatusBadge({ status }: { status: string }) {
    let color: string = workerTheme.colors.success;
    let backgroundColor: string = workerTheme.colors.successSoft;
    let label = "Valid";

    if (status === "expired") {
        color = workerTheme.colors.primary;
        backgroundColor = workerTheme.colors.primarySoft;
        label = "Expired";
    } else if (status === "expiring") {
        color = workerTheme.colors.warning;
        backgroundColor = workerTheme.colors.warningSoft;
        label = "Expiring soon";
    }

    return (
        <View style={[s.badge, { backgroundColor }]}>
            <Text style={[s.badgeText, { color }]}>{label}</Text>
        </View>
    );
}

export default function CertificationsScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={s.container} edges={["top"]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.iconButton}>
                    <Ionicons name="arrow-back" size={24} color={workerTheme.colors.foreground} />
                </TouchableOpacity>
                <Text style={s.title}>Certifications</Text>
                <TouchableOpacity style={s.iconButton} onPress={() => router.push("/add-certification")}>
                    <Ionicons name="add" size={24} color={workerTheme.colors.foreground} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={CERTIFICATIONS}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.listContent}
                renderItem={({ item }) => (
                    <TouchableOpacity style={s.card}>
                        <View style={s.cardHeader}>
                            <View style={s.iconWrap}>
                                <Ionicons
                                    name="ribbon-outline"
                                    size={18}
                                    color={workerTheme.colors.secondary}
                                />
                            </View>
                            <View style={s.cardText}>
                                <Text style={s.cardTitle}>{item.name}</Text>
                                <Text style={s.cardSubtitle}>{item.issuer}</Text>
                            </View>
                            <StatusBadge status={item.status} />
                        </View>

                        <View style={s.cardFooter}>
                            <Text style={s.expiryText}>Expires {item.expires}</Text>
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color={workerTheme.colors.mutedForeground}
                            />
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={s.emptyState}>
                        <Text style={s.emptyText}>No certifications added yet.</Text>
                    </View>
                }
            />
        </SafeAreaView>
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
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: workerTheme.colors.border,
    },
    iconButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        marginBottom: 12,
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.surface,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
    },
    iconWrap: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: workerTheme.colors.secondarySoft,
    },
    cardText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
    },
    cardSubtitle: {
        marginTop: 2,
        fontSize: 13,
        color: workerTheme.colors.mutedForeground,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.6,
    },
    cardFooter: {
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: workerTheme.colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    expiryText: {
        fontSize: 12,
        color: workerTheme.colors.mutedForeground,
    },
    emptyState: {
        paddingVertical: 40,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 14,
        color: workerTheme.colors.mutedForeground,
    },
});
