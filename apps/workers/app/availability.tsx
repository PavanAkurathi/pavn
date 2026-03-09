import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Modal,
    Alert,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { api, WorkerShift, WorkerOrg } from "../lib/api";
import { workerTheme } from "../lib/theme";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORG_COLORS = workerTheme.roleColors;

function getWeekDates(offset: number = 0): Date[] {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + offset * 7);

    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return date;
    });
}

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const fmtWeekRange = (dates: Date[]) => {
    const start = dates[0];
    const end = dates[6];
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", opts)}`;
};

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
    const today = new Date();
    const orgColorMap = new Map<string, string>();

    orgs.forEach((org, index) => {
        orgColorMap.set(org.id, ORG_COLORS[index % ORG_COLORS.length]);
    });

    useEffect(() => {
        void loadData();
    }, [weekOffset]);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await api.worker.getAllShifts("all");
            setShifts(result.shifts);
            setOrgs(result.organizations);
        } catch (error) {
            console.error("Failed to load availability:", error);
        } finally {
            setLoading(false);
        }
    };

    const shiftsForDay = (date: Date) =>
        shifts.filter((shift) => isSameDay(new Date(shift.startTime), date));

    const dayHasConflict = (date: Date) => {
        const dayShifts = shiftsForDay(date);

        for (let i = 0; i < dayShifts.length; i += 1) {
            for (let j = i + 1; j < dayShifts.length; j += 1) {
                const aStart = new Date(dayShifts[i].startTime).getTime();
                const aEnd = new Date(dayShifts[i].endTime).getTime();
                const bStart = new Date(dayShifts[j].startTime).getTime();
                const bEnd = new Date(dayShifts[j].endTime).getTime();

                if (aStart < bEnd && bStart < aEnd) {
                    return true;
                }
            }
        }

        return false;
    };

    const openBlockModal = (date: Date) => {
        setSelectedDate(date);
        setShowBlockModal(true);
    };

    const handleBlockDay = async () => {
        if (!selectedDate) {
            return;
        }

        setBlocking(true);

        try {
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);

            await api.availability.set({
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                type: "unavailable",
            });

            Alert.alert("Blocked", `Marked ${selectedDate.toLocaleDateString()} as unavailable.`);
            setShowBlockModal(false);
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to block day");
        } finally {
            setBlocking(false);
        }
    };

    return (
        <SafeAreaView style={s.container} edges={["top"]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={workerTheme.colors.foreground} />
                </TouchableOpacity>
                <Text style={s.title}>My availability</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={s.weekNav}>
                <TouchableOpacity onPress={() => setWeekOffset((value) => value - 1)} style={s.navButton}>
                    <Ionicons name="chevron-back" size={18} color={workerTheme.colors.foreground} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setWeekOffset(0)} activeOpacity={0.7}>
                    <Text style={s.weekLabel}>{fmtWeekRange(weekDates)}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setWeekOffset((value) => value + 1)} style={s.navButton}>
                    <Ionicons name="chevron-forward" size={18} color={workerTheme.colors.foreground} />
                </TouchableOpacity>
            </View>

            {orgs.length > 1 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={s.legendRow}
                    contentContainerStyle={s.legendContent}
                >
                    {orgs.map((org) => (
                        <View key={org.id} style={s.legendItem}>
                            <View
                                style={[
                                    s.legendDot,
                                    { backgroundColor: orgColorMap.get(org.id) || workerTheme.roleColors[0] },
                                ]}
                            />
                            <Text style={s.legendText}>{org.name}</Text>
                        </View>
                    ))}
                </ScrollView>
            ) : null}

            {loading ? (
                <View style={s.centered}>
                    <ActivityIndicator size="large" color={workerTheme.colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={s.listContent}>
                    {weekDates.map((date) => {
                        const dayShifts = shiftsForDay(date);
                        const isToday = isSameDay(date, today);
                        const hasConflict = dayHasConflict(date);

                        return (
                            <View key={date.toISOString()} style={[s.dayRow, isToday ? s.dayRowToday : null]}>
                                <View style={s.dayLabel}>
                                    <Text style={[s.dayName, isToday ? s.dayNameToday : null]}>
                                        {DAYS[date.getDay()]}
                                    </Text>
                                    <Text style={[s.dayNum, isToday ? s.dayNumToday : null]}>
                                        {date.getDate()}
                                    </Text>
                                    {hasConflict ? <View style={s.conflictDot} /> : null}
                                </View>

                                <View style={s.dayContent}>
                                    {dayShifts.length === 0 ? (
                                        <TouchableOpacity style={s.emptySlot} onPress={() => openBlockModal(date)}>
                                            <Text style={s.emptyText}>Available</Text>
                                            <Ionicons
                                                name="remove-circle-outline"
                                                size={16}
                                                color={workerTheme.colors.mutedForeground}
                                            />
                                        </TouchableOpacity>
                                    ) : (
                                        dayShifts.map((shift) => (
                                            <TouchableOpacity
                                                key={shift.assignmentId}
                                                style={[
                                                    s.shiftBlock,
                                                    {
                                                        borderLeftColor:
                                                            orgColorMap.get(shift.organization.id) ||
                                                            workerTheme.roleColors[0],
                                                    },
                                                ]}
                                                onPress={() => router.push(`/shift/${shift.id}`)}
                                            >
                                                <Text style={s.shiftTitle} numberOfLines={1}>
                                                    {shift.title}
                                                </Text>
                                                <Text style={s.shiftTime}>
                                                    {fmtTime(shift.startTime)} - {fmtTime(shift.endTime)}
                                                </Text>
                                                <Text style={s.shiftOrg} numberOfLines={1}>
                                                    {shift.organization.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))
                                    )}

                                    {hasConflict ? (
                                        <View style={s.conflictWarning}>
                                            <Ionicons
                                                name="alert-circle-outline"
                                                size={13}
                                                color={workerTheme.colors.primary}
                                            />
                                            <Text style={s.conflictText}>Overlap to review</Text>
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            <Modal
                visible={showBlockModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowBlockModal(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={s.modalOverlay}
                    onPress={() => setShowBlockModal(false)}
                >
                    <TouchableOpacity activeOpacity={1} style={s.modalCard}>
                        <Text style={s.modalTitle}>Block this day?</Text>
                        <Text style={s.modalBody}>
                            Mark{" "}
                            {selectedDate?.toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                            })}{" "}
                            as unavailable. Your organizations will see you as unavailable for that day.
                        </Text>

                        <View style={s.modalActions}>
                            <TouchableOpacity
                                style={s.modalSecondary}
                                onPress={() => setShowBlockModal(false)}
                            >
                                <Text style={s.modalSecondaryText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={s.modalPrimary}
                                onPress={handleBlockDay}
                                disabled={blocking}
                            >
                                {blocking ? (
                                    <ActivityIndicator size="small" color={workerTheme.colors.white} />
                                ) : (
                                    <Text style={s.modalPrimaryText}>Block day</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: workerTheme.colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
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
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
    },
    weekNav: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    navButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.surface,
    },
    weekLabel: {
        fontSize: 15,
        fontWeight: "600",
        color: workerTheme.colors.foreground,
    },
    legendRow: {
        maxHeight: 40,
    },
    legendContent: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        gap: 16,
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 999,
    },
    legendText: {
        fontSize: 12,
        color: workerTheme.colors.mutedForeground,
    },
    listContent: {
        paddingBottom: 40,
    },
    dayRow: {
        flexDirection: "row",
        minHeight: 84,
        borderBottomWidth: 1,
        borderBottomColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.surface,
    },
    dayRowToday: {
        backgroundColor: workerTheme.colors.secondarySoft,
    },
    dayLabel: {
        width: 58,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        borderRightWidth: 1,
        borderRightColor: workerTheme.colors.border,
    },
    dayName: {
        fontSize: 11,
        fontWeight: "600",
        color: workerTheme.colors.mutedForeground,
        textTransform: "uppercase",
    },
    dayNameToday: {
        color: workerTheme.colors.secondary,
    },
    dayNum: {
        fontSize: 18,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
        marginTop: 2,
    },
    dayNumToday: {
        color: workerTheme.colors.secondary,
    },
    conflictDot: {
        width: 6,
        height: 6,
        borderRadius: 999,
        backgroundColor: workerTheme.colors.primary,
        marginTop: 6,
    },
    dayContent: {
        flex: 1,
        padding: 10,
        gap: 6,
    },
    emptySlot: {
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: workerTheme.colors.surfaceInset,
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
    },
    emptyText: {
        fontSize: 13,
        color: workerTheme.colors.secondary,
    },
    shiftBlock: {
        borderLeftWidth: 4,
        borderRadius: 12,
        padding: 12,
        backgroundColor: workerTheme.colors.surfaceInset,
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
    },
    shiftTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
    },
    shiftTime: {
        fontSize: 12,
        color: workerTheme.colors.secondary,
        marginTop: 4,
    },
    shiftOrg: {
        fontSize: 12,
        color: workerTheme.colors.mutedForeground,
        marginTop: 4,
    },
    conflictWarning: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 4,
        paddingTop: 2,
    },
    conflictText: {
        fontSize: 11,
        fontWeight: "600",
        color: workerTheme.colors.primary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(13, 13, 13, 0.28)",
        justifyContent: "center",
        padding: 24,
    },
    modalCard: {
        backgroundColor: workerTheme.colors.surface,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
        marginBottom: 10,
    },
    modalBody: {
        fontSize: 14,
        lineHeight: 21,
        color: workerTheme.colors.mutedForeground,
    },
    modalActions: {
        flexDirection: "row",
        gap: 12,
        marginTop: 20,
    },
    modalSecondary: {
        flex: 1,
        minHeight: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.surfaceMuted,
    },
    modalSecondaryText: {
        fontSize: 15,
        fontWeight: "600",
        color: workerTheme.colors.foreground,
    },
    modalPrimary: {
        flex: 1,
        minHeight: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: workerTheme.colors.primary,
    },
    modalPrimaryText: {
        fontSize: 15,
        fontWeight: "700",
        color: workerTheme.colors.white,
    },
});
