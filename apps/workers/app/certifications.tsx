import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// Mock Data
const CERTIFICATIONS = [
    {
        id: "1",
        name: "ServSafe Alcohol",
        issuer: "National Restaurant Association",
        expires: "2025-08-15",
        status: "valid", // valid, expiring, expired
    },
    {
        id: "2",
        name: "Food Handler",
        issuer: "ServSafe",
        expires: "2023-12-01",
        status: "expired",
    },
];

const StatusBadge = ({ status }: { status: string }) => {
    let color = "#22C55E"; // Green
    let bg = "rgba(34, 197, 94, 0.1)";
    let label = "Valid";

    if (status === "expired") {
        color = "#EF4444"; // Red
        bg = "rgba(239, 68, 68, 0.1)";
        label = "Expired";
    } else if (status === "expiring") {
        color = "#F59E0B"; // Amber
        bg = "rgba(245, 158, 11, 0.1)";
        label = "Expiring Soon";
    }

    return (
        <View style={[styles.badge, { backgroundColor: bg, borderColor: color }]}>
            <Text style={[styles.badgeText, { color: color }]}>{label}</Text>
        </View>
    );
};

export default function CertificationsScreen() {
    const router = useRouter();

    const renderItem = ({ item }: { item: typeof CERTIFICATIONS[0] }) => (
        <TouchableOpacity style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.iconContainer}>
                    <Ionicons name="ribbon-outline" size={20} color="#fff" />
                </View>
                <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardSubtitle}>{item.issuer}</Text>
                </View>
                <StatusBadge status={item.status} />
            </View>
            <View style={styles.cardFooter}>
                <Text style={styles.expiryText}>Expires: {item.expires}</Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>Certifications</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => router.push("/add-certification")}>
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <FlatList
                    data={CERTIFICATIONS}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No certifications added yet.</Text>
                        </View>
                    }
                />
            </View>
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
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#222",
    },
    backButton: {
        padding: 4,
        marginLeft: -4,
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#fff",
    },
    addButton: {
        padding: 4,
        marginRight: -4,
    },
    content: {
        flex: 1,
    },
    listContent: {
        padding: 16,
    },
    card: {
        backgroundColor: "#111",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#222",
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 12,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#222",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    cardText: {
        flex: 1,
        marginRight: 8,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#fff",
        marginBottom: 2,
    },
    cardSubtitle: {
        fontSize: 13,
        color: "#888",
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    cardFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderTopWidth: 1,
        borderTopColor: "#222",
        paddingTop: 12,
    },
    expiryText: {
        fontSize: 12,
        color: "#666",
        fontFamily: "monospace", // Giving it a slight 'audit' feel
    },
    emptyState: {
        padding: 32,
        alignItems: "center",
    },
    emptyText: {
        color: "#666",
        fontSize: 14,
    },
});
