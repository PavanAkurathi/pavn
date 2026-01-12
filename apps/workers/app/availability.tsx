import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";

const DAYS = [
    { id: "mon", label: "Monday" },
    { id: "tue", label: "Tuesday" },
    { id: "wed", label: "Wednesday" },
    { id: "thu", label: "Thursday" },
    { id: "fri", label: "Friday" },
    { id: "sat", label: "Saturday" },
    { id: "sun", label: "Sunday" },
];

const TIME_SLOTS = [
    { id: "am", label: "Morning", hours: "Open - 4pm" },
    { id: "pm", label: "Evening", hours: "4pm - 10pm" },
    { id: "late", label: "Late Night", hours: "10pm - Close" },
];

export default function AvailabilityScreen() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
    const [showInfo, setShowInfo] = useState(false);

    // State: dayId -> array of selected slot IDs
    const [schedule, setSchedule] = useState<Record<string, string[]>>({
        mon: ["pm"],
        tue: ["pm"],
        wed: ["pm"],
        thu: ["pm"],
        fri: ["pm", "late"],
        sat: ["am", "pm", "late"],
        sun: [],
    });

    const toggleSlot = (dayId: string, slotId: string) => {
        setSchedule(prev => {
            const currentSlots = prev[dayId] || [];
            if (currentSlots.includes(slotId)) {
                return { ...prev, [dayId]: currentSlots.filter(id => id !== slotId) };
            } else {
                return { ...prev, [dayId]: [...currentSlots, slotId] };
            }
        });
    };

    const isFullDay = (dayId: string) => {
        const slots = schedule[dayId] || [];
        return slots.length === TIME_SLOTS.length;
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>Availability</Text>
                <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.infoButton}>
                    <Ionicons name="information-circle-outline" size={24} color="#007AFF" />
                </TouchableOpacity>
            </View>

            {/* Segmented Control */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, viewMode === "weekly" && styles.tabActive]}
                    onPress={() => setViewMode("weekly")}
                >
                    <Text style={[styles.tabText, viewMode === "weekly" && styles.tabTextActive]}>Weekly Pattern</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, viewMode === "monthly" && styles.tabActive]}
                    onPress={() => setViewMode("monthly")}
                >
                    <Text style={[styles.tabText, viewMode === "monthly" && styles.tabTextActive]}>Monthly Requests</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {viewMode === "weekly" ? (
                    <>
                        <Text style={styles.description}>
                            Your standard recurring schedule. Tap slots to mark availability.
                        </Text>
                        <View style={styles.list}>
                            {DAYS.map((day) => {
                                const slots = schedule[day.id] || [];
                                const hasAvailability = slots.length > 0;
                                const fullDay = isFullDay(day.id);

                                return (
                                    <View key={day.id} style={styles.dayContainer}>
                                        <View style={styles.dayHeader}>
                                            <Text style={[styles.dayLabel, hasAvailability && styles.dayLabelActive]}>
                                                {day.label}
                                            </Text>
                                            <Text style={styles.daySummary}>
                                                {fullDay ? "Any Shift" : (hasAvailability ? `${slots.length} Slots` : "Unavailable")}
                                            </Text>
                                        </View>

                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotRow}>
                                            {TIME_SLOTS.map(slot => {
                                                const isActive = slots.includes(slot.id);
                                                return (
                                                    <TouchableOpacity
                                                        key={slot.id}
                                                        style={[styles.chip, isActive && styles.chipActive]}
                                                        onPress={() => toggleSlot(day.id, slot.id)}
                                                    >
                                                        <Text style={[styles.chipTitle, isActive && styles.chipTextActive]}>
                                                            {slot.label}
                                                        </Text>
                                                        <Text style={[styles.chipSubtitle, isActive && styles.chipTextActive]}>
                                                            {slot.hours}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                );
                            })}
                        </View>
                    </>
                ) : (
                    <View style={styles.monthlyPlaceholder}>
                        <Ionicons name="calendar" size={48} color="#333" />
                        <Text style={styles.monthlyTitle}>Specific Dates & Time Off</Text>
                        <Text style={styles.monthlyText}>
                            Request time off or mark specific dates as unavailable for next month.
                        </Text>
                        <TouchableOpacity style={styles.requestButton}>
                            <Text style={styles.requestButtonText}>+ New Request</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Save Button Floating */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Save Changes</Text>
                </TouchableOpacity>
            </View>

            {/* Info Explain Text in Modal is less needed now, but keeping for "Organization" context */}
            <Modal
                transparent={true}
                visible={showInfo}
                animationType="fade"
                onRequestClose={() => setShowInfo(false)}
            >
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowInfo(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Shift Definitions</Text>
                        <Text style={styles.modalDescription}>
                            These time blocks are set by your manager to match the business's operating hours.
                        </Text>
                        <View style={styles.divide} />
                        <Text style={styles.modalNote}>
                            * If you are only available for part of a block (e.g. 5pm instead of 4pm), select the main block here and add a specific note in "Monthly Requests" for exceptions.
                        </Text>
                    </View>
                </TouchableOpacity>
            </Modal>
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
    infoButton: {
        padding: 4,
        marginRight: -4,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    tabs: {
        flexDirection: "row",
        padding: 16,
        gap: 12,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: "center",
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    tabActive: {
        borderBottomColor: "#007AFF",
    },
    tabText: {
        color: "#666",
        fontSize: 14,
        fontWeight: "600",
    },
    tabTextActive: {
        color: "#fff",
    },
    description: {
        color: "#666",
        fontSize: 14,
        marginBottom: 24,
        lineHeight: 20,
    },
    list: {
        gap: 16,
        paddingBottom: 100, // Space for footer
    },
    dayContainer: {
        backgroundColor: "#111",
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: "#222",
    },
    dayHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    dayLabel: {
        color: "#888",
        fontSize: 16,
        fontWeight: "600",
    },
    dayLabelActive: {
        color: "#fff",
    },
    daySummary: {
        color: "#666",
        fontSize: 12,
        fontWeight: "500",
    },
    slotRow: {
        flexDirection: "row",
        marginBottom: -4, // tight layout
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12, // Softer corners
        backgroundColor: "#222",
        marginRight: 8,
        borderWidth: 1,
        borderColor: "#333",
        minWidth: 100, // Ensure width for text
    },
    chipActive: {
        backgroundColor: "#007AFF",
        borderColor: "#007AFF",
    },
    chipTitle: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 2,
    },
    chipSubtitle: {
        color: "#666",
        fontSize: 11,
    },
    chipTextActive: {
        color: "#fff",
    },
    // Monthly View
    monthlyPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 64,
        gap: 16,
    },
    monthlyTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
        marginTop: 16,
    },
    monthlyText: {
        color: "#666",
        textAlign: "center",
        maxWidth: 240,
        lineHeight: 22,
    },
    requestButton: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: "#222",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#333",
    },
    requestButtonText: {
        color: "#fff",
        fontWeight: "600",
    },
    // Footer
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: "#222",
        backgroundColor: "#000",
    },
    primaryButton: {
        backgroundColor: "#007AFF",
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
    },
    primaryButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.8)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    modalContent: {
        backgroundColor: "#111",
        borderRadius: 16,
        padding: 24,
        width: "100%",
        maxWidth: 320,
        borderWidth: 1,
        borderColor: "#333",
    },
    modalTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 16,
        textAlign: "center",
    },
    modalDescription: {
        color: "#ccc",
        fontSize: 14,
        textAlign: "center",
        marginBottom: 16,
        lineHeight: 20,
    },
    divide: {
        height: 1,
        backgroundColor: "#333",
        marginBottom: 16,
    },
    modalNote: {
        color: "#666",
        fontSize: 12,
        fontStyle: "italic",
        textAlign: "center",
    },
});
