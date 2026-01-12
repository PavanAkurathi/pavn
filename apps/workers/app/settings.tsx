import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function SettingsScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>Settings</Text>
            </View>

            <ScrollView style={styles.content}>

                {/* Availability Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>SCHEDULE</Text>
                    <TouchableOpacity style={styles.row}>
                        <View style={styles.rowIcon}>
                            <Ionicons name="calendar-outline" size={20} color="#fff" />
                        </View>
                        <View style={styles.rowContent}>
                            <Text style={styles.rowTitle}>Availability</Text>
                            <Text style={styles.rowSubtitle}>Set your preferred working hours</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                {/* Certifications Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>COMPLIANCE</Text>
                    <TouchableOpacity style={styles.row}>
                        <View style={styles.rowIcon}>
                            <Ionicons name="ribbon-outline" size={20} color="#fff" />
                        </View>
                        <View style={styles.rowContent}>
                            <Text style={styles.rowTitle}>Certifications</Text>
                            <Text style={styles.rowSubtitle}>ServSafe, TIPS, etc.</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={20} color="#888" />
                    <Text style={styles.infoText}>
                        Expired certifications will prevent you from being scheduled.
                    </Text>
                </View>

            </ScrollView>
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
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#222",
    },
    backButton: {
        marginRight: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#fff",
    },
    content: {
        flex: 1,
    },
    section: {
        marginTop: 24,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: "600",
        color: "#666",
        paddingHorizontal: 16,
        marginBottom: 8,
        letterSpacing: 1,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: "#111",
        marginBottom: 1,
    },
    rowIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#222",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
    },
    rowContent: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 16,
        color: "#fff",
        fontWeight: "500",
    },
    rowSubtitle: {
        fontSize: 13,
        color: "#888",
        marginTop: 2,
    },
    infoBox: {
        flexDirection: "row",
        alignItems: "center",
        margin: 16,
        padding: 12,
        backgroundColor: "#1A1A1A",
        borderRadius: 8,
    },
    infoText: {
        flex: 1,
        color: "#888",
        fontSize: 12,
        marginLeft: 12,
        lineHeight: 18,
    },
});
