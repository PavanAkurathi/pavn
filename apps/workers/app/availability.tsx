import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { api, WorkerShift, WorkerOrg } from "../lib/api";

// =============================================================================
// HELPERS
// =============================================================================

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORG_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

function getWeekDates(offset: number = 0): Date[] {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + (offset * 7)); // Sunday
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });
}

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const fmtWeekRange = (dates: Date[]) => {
    const s = dates[0];
    const e = dates[6];
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${s.toLocaleDateString("en-US", opts)} - ${e.toLocaleDateString("en-US", opts)}`;
};

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function AvailabilityScreen() {
    const router = useRouter();
    const [weekOffset, setWeekOffset] = useState(0);
    const [shifts, setShifts] = useState<WorkerShift[]>([]);
    const [orgs, setOrgs] = useState<WorkerOrg[]>([]);
    const [loading, setLoading] = useState(true);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [blocking, setBlocking] = useState(false);

    const weekDates = getWeekDates(weekOffset);
    const orgColorMap = new Map<string, string>();
    orgs.forEach((o, i) => orgColorMap.set(o.id, ORG_COLORS[i % ORG_COLORS.length]));

    useEffect(() => { loadData(); }, [weekOffset]);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await api.worker.getAllShifts('all');
            setShifts(result.shifts);
            setOrgs(result.organizations);
        } catch (e) {
            console.error("Failed to load:", e);
        } finally {
            setLoading(false);
        }
    };

    const shiftsForDay = (date: Date) => {
        return shifts.filter(s => isSameDay(new Date(s.startTime), date));
    };

    // Check for conflicts on a day
    const dayHasConflict = (date: Date) => {
        const dayShifts = shiftsForDay(date);
        for (let i = 0; i < dayShifts.length; i++) {
            for (let j = i + 1; j < dayShifts.length; j++) {
                const aStart = new Date(dayShifts[i].startTime).getTime();
                const aEnd = new Date(dayShifts[i].endTime).getTime();
                const bStart = new Date(dayShifts[j].startTime).getTime();
                const bEnd = new Date(dayShifts[j].endTime).getTime();
                if (aStart < bEnd && bStart < aEnd) return true;
            }
        }
        return false;
    };

    const handleBlockDay = async () => {
        if (!selectedDate) return;
        setBlocking(true);
        try {
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);
            await api.availability.set({
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                type: 'unavailable',
            });
            Alert.alert("Blocked", `Marked ${selectedDate.toLocaleDateString()} as unavailable`);
            setShowBlockModal(false);
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to block day");
        } finally {
            setBlocking(false);
        }
    };

    const today = new Date();

    return (
        <SafeAreaView style={s.container} edges={["top"]}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={s.title}>My Availability</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Week Navigator */}
            <View style={s.weekNav}>
                <TouchableOpacity onPress={() => setWeekOffset(w => w - 1)} style={s.navBtn}>
                    <Ionicons name="chevron-back" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setWeekOffset(0)}>
                    <Text style={s.weekLabel}>{fmtWeekRange(weekDates)}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setWeekOffset(w => w + 1)} style={s.navBtn}>
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Org Legend */}
            {orgs.length > 1 && (
                <ScrollView horizontal style={s.legendRow} showsHorizontalScrollIndicator={false}>
                    {orgs.map(o => (
                        <View key={o.id} style={s.legendItem}>
                            <View style={[s.legendDot, { backgroundColor: orgColorMap.get(o.id) }]} />
                            <Text style={s.legendText}>{o.name}</Text>
                        </View>
                    ))}
                </ScrollView>
            )}

            {/* Calendar Grid */}
            {loading ? (
                <View style={s.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>
            ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                    {weekDates.map((date, idx) => {
                        const dayShifts = shiftsForDay(date);
                        const isToday = isSameDay(date, today);
                        const hasConflict = dayHasConflict(date);

                        return (
                            <View key={idx} style={[s.dayRow, isToday && s.dayRowToday]}>
                                {/* Day label */}
                                <View style={s.dayLabel}>
                                    <Text style={[s.dayName, isToday && s.dayNameToday]}>{DAYS[date.getDay()]}</Text>
                                    <Text style={[s.dayNum, isToday && s.dayNumToday]}>{date.getDate()}</Text>
                                    {hasConflict && (
                                        <View style={s.conflictDot} />
                                    )}
                                </View>

                                {/* Shifts for this day */}
                                <View style={s.dayContent}>
                                    {dayShifts.length === 0 ? (
                                        <TouchableOpacity
                                            style={s.emptySlot}
                                            onPress={() => { setSelectedDate(date); setShowBlockModal(true); }}
                                        >
                                            <Text style={s.emptyText}>Available</Text>
                                            <Ionicons name="remove-circle-outline" size={16} color="#444" />
                                        </TouchableOpacity>
                                    ) : (
                                        dayShifts.map(shift => (
                                            <TouchableOpacity
                                                key={shift.id}
                                                style={[s.shiftBlock, { borderLeftColor: orgColorMap.get(shift.organization.id) || "#666" }]}
                                                onPress={() => router.push(`/shift/${shift.id}`)}
                                            >
                                                <Text style={s.shiftBlockTitle} numberOfLines={1}>{shift.title}</Text>
                                                <Text style={s.shiftBlockTime}>
                                                    {fmtTime(shift.startTime)} - {fmtTime(shift.endTime)}
                                                </Text>
                                                <Text style={s.shiftBlockOrg} numberOfLines={1}>{shift.organization.name}</Text>
                                            </TouchableOpacity>
                                        ))
                                    )}

                                    {/* Conflict warning */}
                                    {hasConflict && (
                                        <View style={s.conflictWarning}>
                                            <Ionicons name="warning" size={12} color="#F59E0B" />
                                            <Text style={s.conflictText}>Schedule conflict</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {/* Block Day Modal */}
            <Modal visible={showBlockModal} transparent animationType="fade" onRequestClose={() => setShowBlockModal(false)}>
                <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowBlockModal(false)}>
                    <View style={s.modalContent}>
                        <Text style={s.modalTitle}>Block this day?</Text>
                        <Text style={s.modalDesc}>
                            Mark {selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} as unavailable. All organizations will see you as unavailable.
                        </Text>
                        <View style={s.modalBtns}>
                            <TouchableOpacity style={s.modalCancel} onPress={() => setShowBlockModal(false)}>
                                <Text style={s.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.modalConfirm} onPress={handleBlockDay} disabled={blocking}>
                                {blocking ? <ActivityIndicator color="#fff" size="small" /> : (
                                    <Text style={s.modalConfirmText}>Block Day</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

// =============================================================================
// STYLES
// =============================================================================

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0A0A0A" },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1A1A1A",
    },
    title: { fontSize: 18, fontWeight: "700", color: "#fff" },

    weekNav: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 12,
    },
    navBtn: { padding: 6 },
    weekLabel: { fontSize: 15, fontWeight: "600", color: "#ccc" },

    legendRow: { paddingHorizontal: 16, paddingBottom: 8 },
    legendItem: { flexDirection: "row", alignItems: "center", marginRight: 16 },
    legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    legendText: { fontSize: 12, color: "#888" },

    dayRow: {
        flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#141414",
        minHeight: 72,
    },
    dayRowToday: { backgroundColor: "#0F1A2E" },
    dayLabel: {
        width: 52, alignItems: "center", justifyContent: "center",
        paddingVertical: 12, borderRightWidth: 1, borderRightColor: "#1A1A1A",
    },
    dayName: { fontSize: 11, color: "#666", fontWeight: "500" },
    dayNameToday: { color: "#3B82F6" },
    dayNum: { fontSize: 18, fontWeight: "700", color: "#888", marginTop: 2 },
    dayNumToday: { color: "#3B82F6" },
    conflictDot: {
        width: 6, height: 6, borderRadius: 3, backgroundColor: "#F59E0B", marginTop: 4,
    },

    dayContent: { flex: 1, padding: 8, gap: 4 },
    emptySlot: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingVertical: 6, paddingHorizontal: 8,
    },
    emptyText: { fontSize: 13, color: "#444" },

    shiftBlock: {
        backgroundColor: "#141414", borderRadius: 6, padding: 8,
        borderLeftWidth: 3, borderLeftColor: "#666",
    },
    shiftBlockTitle: { fontSize: 13, fontWeight: "600", color: "#fff" },
    shiftBlockTime: { fontSize: 11, color: "#999", marginTop: 1 },
    shiftBlockOrg: { fontSize: 11, color: "#666", marginTop: 1 },

    conflictWarning: {
        flexDirection: "row", alignItems: "center", gap: 4,
        paddingHorizontal: 8, paddingVertical: 3,
    },
    conflictText: { fontSize: 11, color: "#F59E0B" },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: "rgba(0,0,0,0.8)",
        justifyContent: "center", alignItems: "center", padding: 24,
    },
    modalContent: {
        backgroundColor: "#1A1A1A", borderRadius: 16, padding: 24,
        width: "100%", maxWidth: 340,
    },
    modalTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 8 },
    modalDesc: { fontSize: 14, color: "#999", lineHeight: 20, marginBottom: 20 },
    modalBtns: { flexDirection: "row", gap: 12 },
    modalCancel: {
        flex: 1, paddingVertical: 12, borderRadius: 8,
        borderWidth: 1, borderColor: "#333", alignItems: "center",
    },
    modalCancelText: { color: "#999", fontWeight: "500" },
    modalConfirm: {
        flex: 1, paddingVertical: 12, borderRadius: 8,
        backgroundColor: "#EF4444", alignItems: "center",
    },
    modalConfirmText: { color: "#fff", fontWeight: "600" },
});
