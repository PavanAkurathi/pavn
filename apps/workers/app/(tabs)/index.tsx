import { View, Text, StyleSheet, TouchableOpacity, SectionList, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { api, WorkerShift, ConflictInfo, WorkerOrg } from "../../lib/api";

// =============================================================================
// HELPERS
// =============================================================================

const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

const formatHours = (hours: number | null): string => {
    if (hours === null || hours === undefined) return "—";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

const isInProgress = (shift: WorkerShift): boolean => {
    return !!shift.timesheet.clockIn && !shift.timesheet.clockOut &&
        new Date(shift.endTime) > new Date(Date.now() - 2 * 60 * 60 * 1000);
};

// Distinct org colors for visual separation
const ORG_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

// =============================================================================
// SHIFT CARD
// =============================================================================

interface ShiftCardProps {
    shift: WorkerShift;
    conflict?: ConflictInfo;
    orgColor: string;
    onPress: () => void;
}

function ShiftCard({ shift, conflict, orgColor, onPress }: ShiftCardProps) {
    const inProgress = isInProgress(shift);
    const hoursLabel = shift.hours.worked !== null
        ? formatHours(shift.hours.worked)
        : formatHours(shift.hours.scheduled);
    const isWorked = shift.hours.worked !== null;
    const lateMinutes = shift.timesheet.clockIn
        ? Math.max(0, Math.round((new Date(shift.timesheet.clockIn).getTime() - new Date(shift.startTime).getTime()) / 60000))
        : 0;

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            {/* Org color bar */}
            <View style={[styles.orgBar, { backgroundColor: orgColor }]} />

            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <Text style={styles.shiftTitle} numberOfLines={1}>{shift.title}</Text>
                    <View style={styles.hoursContainer}>
                        <Text style={[styles.hoursText, isWorked && styles.hoursWorked]}>
                            {hoursLabel}
                        </Text>
                        {inProgress && (
                            <View style={styles.liveDot} />
                        )}
                    </View>
                </View>

                <Text style={styles.shiftTime}>
                    {formatDate(shift.startTime)}, {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                    {shift.hours.breakMinutes > 0 && (
                        <Text style={styles.breakText}> · {shift.hours.breakMinutes}m break</Text>
                    )}
                </Text>

                <Text style={styles.orgName}>{shift.organization.name}</Text>
                {shift.location.address && (
                    <Text style={styles.locationText} numberOfLines={1}>{shift.location.address}</Text>
                )}

                {/* Late indicator */}
                {lateMinutes > 0 && lateMinutes < 120 && (
                    <View style={styles.lateRow}>
                        <Ionicons name="warning-outline" size={12} color="#EF4444" />
                        <Text style={styles.lateText}>Clocked in {lateMinutes} min late</Text>
                    </View>
                )}

                {/* Conflict warning */}
                {conflict && (
                    <View style={styles.conflictRow}>
                        <Ionicons name="alert-circle" size={14} color="#F59E0B" />
                        <Text style={styles.conflictText}>
                            Overlaps with {conflict.overlapsWithTitle} at {conflict.overlapsWithOrg}
                        </Text>
                    </View>
                )}

                {/* Flags */}
                {shift.timesheetFlags.missingClockIn && (
                    <View style={styles.flagRow}>
                        <Ionicons name="time-outline" size={12} color="#F59E0B" />
                        <Text style={styles.flagText}>Missing clock-in</Text>
                    </View>
                )}
                {shift.timesheetFlags.missingClockOut && (
                    <View style={styles.flagRow}>
                        <Ionicons name="time-outline" size={12} color="#F59E0B" />
                        <Text style={styles.flagText}>Missing clock-out</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}

// =============================================================================
// ORG FILTER CHIPS
// =============================================================================

interface OrgFilterProps {
    organizations: WorkerOrg[];
    selectedOrgId: string | null;
    onSelect: (orgId: string | null) => void;
    orgColorMap: Map<string, string>;
}

function OrgFilter({ organizations, selectedOrgId, onSelect, orgColorMap }: OrgFilterProps) {
    if (organizations.length <= 1) return null;

    return (
        <View style={styles.filterRow}>
            <TouchableOpacity
                style={[styles.filterChip, !selectedOrgId && styles.filterChipActive]}
                onPress={() => onSelect(null)}
            >
                <Text style={[styles.filterChipText, !selectedOrgId && styles.filterChipTextActive]}>
                    All ({organizations.length})
                </Text>
            </TouchableOpacity>
            {organizations.map(org => (
                <TouchableOpacity
                    key={org.id}
                    style={[
                        styles.filterChip,
                        selectedOrgId === org.id && styles.filterChipActive,
                        { borderColor: orgColorMap.get(org.id) || "#666" }
                    ]}
                    onPress={() => onSelect(selectedOrgId === org.id ? null : org.id)}
                >
                    <View style={[styles.filterDot, { backgroundColor: orgColorMap.get(org.id) || "#666" }]} />
                    <Text style={[
                        styles.filterChipText,
                        selectedOrgId === org.id && styles.filterChipTextActive
                    ]} numberOfLines={1}>
                        {org.name}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

// =============================================================================
// MAIN SCREEN
// =============================================================================

type ViewMode = 'schedule' | 'history';

export default function ScheduleScreen() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<ViewMode>('schedule');
    const [shifts, setShifts] = useState<WorkerShift[]>([]);
    const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
    const [organizations, setOrganizations] = useState<WorkerOrg[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Org color mapping
    const orgColorMap = new Map<string, string>();
    organizations.forEach((org, i) => orgColorMap.set(org.id, ORG_COLORS[i % ORG_COLORS.length]));

    // Conflict lookup
    const conflictMap = new Map<string, ConflictInfo>();
    conflicts.forEach(c => {
        if (!conflictMap.has(c.shiftId)) conflictMap.set(c.shiftId, c);
    });

    useEffect(() => { loadData(); }, [viewMode, selectedOrgId]);

    const loadData = async () => {
        try {
            if (!refreshing) setLoading(true);
            const status = viewMode === 'history' ? 'history' : 'all';
            const result = await api.worker.getAllShifts(status, selectedOrgId || undefined);
            setShifts(result.shifts);
            setConflicts(result.conflicts);
            if (result.organizations.length > 0) {
                setOrganizations(result.organizations);
            }
        } catch (err) {
            console.error("Failed to load shifts:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [viewMode, selectedOrgId]);

    // Split shifts into sections
    const buildSections = () => {
        if (viewMode === 'history') {
            return groupByDate(shifts, "Past shifts");
        }

        const now = new Date();
        const inProgressShifts = shifts.filter(s => isInProgress(s));
        const upcomingShifts = shifts.filter(s =>
            !isInProgress(s) &&
            ['published', 'assigned', 'in-progress'].includes(s.status) &&
            new Date(s.endTime) > now
        );
        const recentShifts = shifts.filter(s =>
            !isInProgress(s) &&
            (['completed', 'approved'].includes(s.status) || new Date(s.endTime) <= now)
        );

        const sections: Array<{ title: string; data: WorkerShift[] }> = [];
        if (inProgressShifts.length > 0) sections.push({ title: "In progress", data: inProgressShifts });
        if (upcomingShifts.length > 0) sections.push(...groupByDate(upcomingShifts, "Upcoming"));
        if (recentShifts.length > 0 && recentShifts.length <= 5) {
            sections.push({ title: "Recent", data: recentShifts.slice(0, 3) });
        }
        return sections;
    };

    const groupByDate = (items: WorkerShift[], fallbackTitle: string) => {
        if (items.length === 0) return [];
        const groups: Map<string, WorkerShift[]> = new Map();
        items.forEach(s => {
            const key = formatDate(s.startTime);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(s);
        });
        return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
    };

    const sections = buildSections();

    // Active shift banner
    const activeShift = shifts.find(s => isInProgress(s));

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>My Schedule</Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={() => router.push("/notifications")} style={styles.headerIcon}>
                        <Ionicons name="notifications-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* View Toggle */}
            <View style={styles.toggleRow}>
                <TouchableOpacity
                    style={[styles.toggleBtn, viewMode === 'schedule' && styles.toggleActive]}
                    onPress={() => setViewMode('schedule')}
                >
                    <Text style={[styles.toggleText, viewMode === 'schedule' && styles.toggleTextActive]}>
                        Schedule
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleBtn, viewMode === 'history' && styles.toggleActive]}
                    onPress={() => setViewMode('history')}
                >
                    <Text style={[styles.toggleText, viewMode === 'history' && styles.toggleTextActive]}>
                        History
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Org Filter */}
            <OrgFilter
                organizations={organizations}
                selectedOrgId={selectedOrgId}
                onSelect={setSelectedOrgId}
                orgColorMap={orgColorMap}
            />

            {/* Shift List */}
            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            ) : sections.length === 0 ? (
                <View style={styles.centered}>
                    <Ionicons name="calendar-outline" size={48} color="#444" />
                    <Text style={styles.emptyText}>
                        {viewMode === 'history' ? "No past shifts" : "No upcoming shifts"}
                    </Text>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id + item.assignmentId}
                    renderSectionHeader={({ section }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            {section.title === "In progress" && (
                                <View style={styles.liveIndicator}>
                                    <View style={styles.livePulse} />
                                    <Text style={styles.liveLabel}>LIVE</Text>
                                </View>
                            )}
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <ShiftCard
                            shift={item}
                            conflict={conflictMap.get(item.id)}
                            orgColor={orgColorMap.get(item.organization.id) || "#666"}
                            onPress={() => router.push(`/shift/${item.id}`)}
                        />
                    )}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#3B82F6"
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    stickySectionHeadersEnabled={false}
                />
            )}

            {/* Active shift banner */}
            {activeShift && !loading && (
                <TouchableOpacity
                    style={styles.activeBanner}
                    onPress={() => router.push(`/shift/${activeShift.id}`)}
                >
                    <View style={styles.activeBannerLeft}>
                        <View style={styles.activePulse} />
                        <View>
                            <Text style={styles.activeBannerTitle}>Shift in progress</Text>
                            <Text style={styles.activeBannerSub} numberOfLines={1}>
                                {activeShift.title} · {activeShift.organization.name}
                            </Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0A0A0A" },
    header: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", paddingHorizontal: 20, paddingVertical: 12,
    },
    title: { fontSize: 26, fontWeight: "700", color: "#fff" },
    headerRight: { flexDirection: "row", gap: 12 },
    headerIcon: { padding: 4 },

    // Toggle
    toggleRow: {
        flexDirection: "row", marginHorizontal: 20, marginBottom: 8,
        backgroundColor: "#1A1A1A", borderRadius: 10, padding: 3,
    },
    toggleBtn: {
        flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8,
    },
    toggleActive: { backgroundColor: "#2A2A2A" },
    toggleText: { color: "#888", fontSize: 14, fontWeight: "500" },
    toggleTextActive: { color: "#fff" },

    // Org Filter
    filterRow: {
        flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8,
        gap: 8, flexWrap: "nowrap",
    },
    filterChip: {
        flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
        paddingVertical: 6, borderRadius: 20, borderWidth: 1,
        borderColor: "#333", backgroundColor: "#1A1A1A",
    },
    filterChipActive: { backgroundColor: "#2A2A2A", borderColor: "#555" },
    filterChipText: { color: "#888", fontSize: 13 },
    filterChipTextActive: { color: "#fff" },
    filterDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },

    // Section
    sectionHeader: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
    },
    sectionTitle: { fontSize: 16, fontWeight: "600", color: "#ccc" },
    liveIndicator: { flexDirection: "row", alignItems: "center", gap: 6 },
    livePulse: {
        width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E",
    },
    liveLabel: { fontSize: 11, fontWeight: "700", color: "#22C55E", letterSpacing: 1 },

    // Card
    card: {
        flexDirection: "row", marginHorizontal: 16, marginBottom: 10,
        backgroundColor: "#141414", borderRadius: 12, overflow: "hidden",
    },
    orgBar: { width: 4 },
    cardContent: { flex: 1, padding: 14 },
    cardHeader: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        marginBottom: 4,
    },
    shiftTitle: { fontSize: 16, fontWeight: "600", color: "#fff", flex: 1, marginRight: 8 },
    hoursContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
    hoursText: { fontSize: 15, fontWeight: "600", color: "#888" },
    hoursWorked: { color: "#fff" },
    liveDot: {
        width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E",
    },
    shiftTime: { fontSize: 13, color: "#999", marginBottom: 3 },
    breakText: { color: "#666" },
    orgName: { fontSize: 13, color: "#3B82F6", marginBottom: 1 },
    locationText: { fontSize: 12, color: "#666" },

    lateRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
    lateText: { fontSize: 12, color: "#EF4444" },

    conflictRow: {
        flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6,
        backgroundColor: "#2D2000", paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 6,
    },
    conflictText: { fontSize: 12, color: "#F59E0B", flex: 1 },

    flagRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    flagText: { fontSize: 12, color: "#F59E0B" },

    // States
    centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
    emptyText: { fontSize: 15, color: "#666" },
    listContent: { paddingBottom: 100 },

    // Active shift banner
    activeBanner: {
        position: "absolute", bottom: 0, left: 0, right: 0,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: "#166534", paddingHorizontal: 16, paddingVertical: 14,
    },
    activeBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    activePulse: {
        width: 10, height: 10, borderRadius: 5, backgroundColor: "#4ADE80",
    },
    activeBannerTitle: { fontSize: 14, fontWeight: "700", color: "#fff" },
    activeBannerSub: { fontSize: 12, color: "#BBF7D0" },
});
