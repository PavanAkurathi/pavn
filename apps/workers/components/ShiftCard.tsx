import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ShiftCardProps {
    role: string;
    time: string;
    venue: string;
    status: "upcoming" | "completed" | "open";
    rate?: string;
}

export function ShiftCard({ role, time, venue, status, rate }: ShiftCardProps) {
    return (
        <View style={styles.container}>
            <View style={styles.leftColumn}>
                <Text style={styles.role}>{role}</Text>
                <Text style={styles.details}>{time} • {venue}</Text>
            </View>
            <View style={styles.rightColumn}>
                {status === "open" && rate ? (
                    <Text style={styles.rate}>{rate}</Text>
                ) : (
                    <View style={styles.statusBadge}>
                        {status === "upcoming" && <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />}
                        <Text style={[styles.statusText, status === "upcoming" && styles.statusConfirmed]}>
                            {status === "upcoming" ? "Confirmed" : status}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10, // Very compact
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#222",
        backgroundColor: "#000",
    },
    leftColumn: {
        flex: 1,
        justifyContent: "center",
    },
    role: {
        fontSize: 15, // Sleek, readable but small
        fontWeight: "600",
        color: "#fff",
        marginBottom: 2,
    },
    details: {
        fontSize: 13,
        color: "#888",
    },
    rightColumn: {
        alignItems: "flex-end",
        justifyContent: "center",
        minWidth: 80,
    },
    rate: {
        fontSize: 15,
        fontWeight: "600",
        color: "#fff",
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    statusText: {
        fontSize: 13,
        fontWeight: "500",
        color: "#666",
    },
    statusConfirmed: {
        color: "#4CAF50",
    }
});
