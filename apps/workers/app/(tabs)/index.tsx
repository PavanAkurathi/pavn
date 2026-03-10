import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SectionList,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { api, WorkerShift, ConflictInfo, WorkerOrg, SessionExpiredError } from "../../lib/api";
import { workerTheme } from "../../lib/theme";
import { registerGeofences } from "../../services/geofencing";

const ORG_COLORS = workerTheme.roleColors;

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const formatSectionDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
    });

const isInProgress = (shift: WorkerShift): boolean =>
    !!shift.timesheet.clockIn &&
    !shift.timesheet.clockOut &&
    new Date(shift.endTime) > new Date(Date.now() - 2 * 60 * 60 * 1000);

const isCancelled = (shift: WorkerShift): boolean => shift.status === "cancelled";

type ViewMode = "schedule" | "history";

function FilterChip({
    label,
    active,
    onPress,
    outlineColor,
}: {
    label: string;
    active?: boolean;
    onPress?: () => void;
    outlineColor?: string;
}) {
    return (
        <TouchableOpacity
            style={[
                styles.filterChip,
                active && styles.filterChipActive,
                outlineColor ? { borderColor: outlineColor } : null,
            ]}
            onPress={onPress}
            activeOpacity={0.75}
            disabled={!onPress}
        >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function ShiftRow({
    shift,
    conflict,
    orgColor,
    onPress,
}: {
    shift: WorkerShift;
    conflict?: ConflictInfo;
    orgColor: string;
    onPress: () => void;
}) {
    const venueLabel = shift.location.name || shift.organization.name;
    const addressLabel = shift.location.address || shift.organization.name;
    const needsAttention =
        shift.timesheetFlags.missingClockIn ||
        shift.timesheetFlags.missingClockOut ||
        shift.timesheetFlags.needsReview;

    return (
        <TouchableOpacity style={styles.shiftRow} onPress={onPress} activeOpacity={0.82}>
            <View style={styles.shiftRowHeader}>
                <Text style={styles.shiftTitle}>{shift.title}</Text>
                {isInProgress(shift) ? (
                    <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveBadgeText}>Live</Text>
                    </View>
                ) : isCancelled(shift) ? (
                    <View style={styles.cancelledBadge}>
                        <Ionicons name="close-circle" size={13} color={workerTheme.colors.destructive} />
                        <Text style={styles.cancelledBadgeText}>Cancelled</Text>
                    </View>
                ) : null}
            </View>

            <Text style={styles.shiftTime}>
                {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
            </Text>

            <Text style={styles.shiftVenue}>{venueLabel}</Text>
            <Text style={styles.shiftAddress}>{addressLabel}</Text>

            <View style={styles.metaRow}>
                <View style={[styles.orgBadge, { borderColor: orgColor, backgroundColor: `${orgColor}12` }]}>
                    <View style={[styles.orgBadgeDot, { backgroundColor: orgColor }]} />
                    <Text style={styles.orgBadgeText} numberOfLines={1}>
                        {shift.organization.name}
                    </Text>
                </View>

                {needsAttention ? (
                    <View style={styles.needsAttentionBadge}>
                        <Ionicons
                            name="alert-circle-outline"
                            size={12}
                            color={workerTheme.colors.secondary}
                        />
                        <Text style={styles.needsAttentionText}>Needs review</Text>
                    </View>
                ) : null}
            </View>

            {conflict ? (
                <View style={styles.conflictBox}>
                    <Ionicons name="alert-circle" size={14} color={workerTheme.colors.primary} />
                    <Text style={styles.conflictText}>
                        Overlaps with another shift at {conflict.overlapsWithOrg}
                    </Text>
                </View>
            ) : null}
        </TouchableOpacity>
    );
}

export default function ScheduleScreen() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<ViewMode>("schedule");
    const [shifts, setShifts] = useState<WorkerShift[]>([]);
    const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
    const [organizations, setOrganizations] = useState<WorkerOrg[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const orgColorMap = new Map<string, string>();
    organizations.forEach((org, index) => {
        orgColorMap.set(org.id, ORG_COLORS[index % ORG_COLORS.length]);
    });

    const conflictMap = new Map<string, ConflictInfo>();
    conflicts.forEach((conflict) => {
        if (!conflictMap.has(conflict.shiftId)) {
            conflictMap.set(conflict.shiftId, conflict);
        }
    });

    useEffect(() => {
        void loadData();
    }, [viewMode, selectedOrgId]);

    const loadData = async () => {
        try {
            if (!refreshing) {
                setLoading(true);
            }

            const status = viewMode === "history" ? "history" : "all";
            const result = await api.worker.getAllShifts(status, selectedOrgId || undefined);
            setShifts(result.shifts);
            setConflicts(result.conflicts);
            setOrganizations(result.organizations);
            await registerGeofences(result.shifts);
        } catch (error) {
            if (!(error instanceof SessionExpiredError)) {
                console.error("Failed to load worker shifts:", error);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void loadData();
    }, [viewMode, selectedOrgId]);

    const inProgressShift = shifts.find((shift) => isInProgress(shift));
    const futureShifts = shifts.filter((shift) => {
        return !isInProgress(shift) && new Date(shift.endTime) > new Date();
    });
    const historyShifts = shifts.filter((shift) => !isInProgress(shift));

    const shiftsToRender = viewMode === "history" ? historyShifts : futureShifts;
    const sections = buildSections(shiftsToRender);
    const totalConflicts = conflicts.length;
    const selectedOrganization = organizations.find((organization) => organization.id === selectedOrgId);

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>My shifts</Text>
                    <Text style={styles.subtitle}>
                        {selectedOrganization
                            ? `Showing ${selectedOrganization.name}`
                            : `Showing all orgs${organizations.length > 0 ? ` · ${organizations.length}` : ""}`}
                    </Text>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.headerIcon}
                        onPress={() => router.push("/notifications")}
                        activeOpacity={0.75}
                    >
                        <Ionicons
                            name="notifications-outline"
                            size={21}
                            color={workerTheme.colors.foreground}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerIcon}
                        onPress={() => router.push("/(tabs)/profile")}
                        activeOpacity={0.75}
                    >
                        <Ionicons
                            name="person-circle-outline"
                            size={22}
                            color={workerTheme.colors.foreground}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtersContent}
                style={styles.filtersScroller}
            >
                <FilterChip
                    label="All orgs"
                    active={!selectedOrgId}
                    onPress={() => setSelectedOrgId(null)}
                />

                {organizations.map((org) => (
                    <FilterChip
                        key={org.id}
                        label={org.name}
                        active={selectedOrgId === org.id}
                        onPress={() => setSelectedOrgId(selectedOrgId === org.id ? null : org.id)}
                        outlineColor={orgColorMap.get(org.id)}
                    />
                ))}

                <FilterChip
                    label="Upcoming"
                    active={viewMode === "schedule"}
                    onPress={() => setViewMode("schedule")}
                />
                <FilterChip
                    label="History"
                    active={viewMode === "history"}
                    onPress={() => setViewMode("history")}
                />

                {totalConflicts > 0 ? (
                    <FilterChip label={`Conflicts: ${totalConflicts}`} />
                ) : null}
            </ScrollView>

            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={workerTheme.colors.primary} />
                </View>
            ) : sections.length === 0 ? (
                    <View style={styles.centered}>
                    <Ionicons
                        name="calendar-clear-outline"
                        size={44}
                        color={workerTheme.colors.subtleForeground}
                    />
                    <Text style={styles.emptyTitle}>
                        {viewMode === "history" ? "No shift history yet" : "No upcoming shifts"}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                        {viewMode === "history"
                            ? "Completed and past shifts will show here."
                            : "New shifts will appear here across all organizations."}
                    </Text>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => `${item.id}:${item.assignmentId}`}
                    stickySectionHeadersEnabled={false}
                    renderSectionHeader={({ section }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <ShiftRow
                            shift={item}
                            conflict={conflictMap.get(item.id)}
                            orgColor={orgColorMap.get(item.organization.id) || workerTheme.roleColors[5]}
                            onPress={() => router.push(`/shift/${item.id}`)}
                        />
                    )}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={workerTheme.colors.primary}
                        />
                    }
                    contentContainerStyle={[
                        styles.listContent,
                        inProgressShift ? styles.listContentWithBanner : null,
                    ]}
                />
            )}

            {inProgressShift ? (
                <TouchableOpacity
                    style={styles.activeBanner}
                    activeOpacity={0.88}
                    onPress={() => router.push(`/shift/${inProgressShift.id}`)}
                >
                    <View style={styles.activeIconWrap}>
                        <Ionicons name="time-outline" size={26} color={workerTheme.colors.white} />
                    </View>

                    <View style={styles.activeContent}>
                        <Text style={styles.activeTitle}>Shift in progress</Text>
                        <Text style={styles.activeLine} numberOfLines={1}>
                            {inProgressShift.title} / {inProgressShift.organization.name}
                        </Text>
                        <Text style={styles.activeLine} numberOfLines={1}>
                            {inProgressShift.location.name}
                        </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={22} color={workerTheme.colors.white} />
                </TouchableOpacity>
            ) : null}
        </SafeAreaView>
    );
}

function buildSections(shifts: WorkerShift[]) {
    const sections = new Map<string, WorkerShift[]>();

    for (const shift of shifts) {
        const key = formatSectionDate(shift.startTime);
        if (!sections.has(key)) {
            sections.set(key, []);
        }
        sections.get(key)!.push(shift);
    }

    return Array.from(sections.entries()).map(([title, data]) => ({ title, data }));
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: workerTheme.colors.background,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        paddingHorizontal: 22,
        paddingTop: 10,
        paddingBottom: 12,
    },
    title: {
        fontSize: 34,
        lineHeight: 38,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
        letterSpacing: -0.8,
    },
    subtitle: {
        marginTop: 6,
        fontSize: 14,
        color: workerTheme.colors.mutedForeground,
    },
    headerActions: {
        flexDirection: "row",
        gap: 10,
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: workerTheme.colors.surface,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
    },
    filtersScroller: {
        maxHeight: 56,
    },
    filtersContent: {
        paddingHorizontal: 18,
        paddingBottom: 8,
        gap: 10,
    },
    filterChip: {
        minHeight: 42,
        paddingHorizontal: 18,
        borderRadius: 21,
        borderWidth: 1.5,
        borderColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    filterChipActive: {
        borderColor: workerTheme.colors.foreground,
        backgroundColor: workerTheme.colors.foreground,
    },
    filterChipText: {
        fontSize: 15,
        fontWeight: "500",
        color: workerTheme.colors.foreground,
    },
    filterChipTextActive: {
        color: workerTheme.colors.white,
    },
    sectionHeader: {
        paddingHorizontal: 22,
        paddingTop: 18,
        paddingBottom: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
    },
    shiftRow: {
        marginHorizontal: 22,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: workerTheme.colors.border,
    },
    shiftRowHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    shiftTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
    },
    liveBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: workerTheme.colors.primarySoft,
    },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 999,
        backgroundColor: workerTheme.colors.primary,
    },
    liveBadgeText: {
        fontSize: 12,
        fontWeight: "700",
        color: workerTheme.colors.primary,
    },
    cancelledBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: workerTheme.colors.destructiveSoft,
    },
    cancelledBadgeText: {
        fontSize: 12,
        fontWeight: "700",
        color: workerTheme.colors.destructive,
    },
    shiftTime: {
        marginTop: 8,
        fontSize: 17,
        color: workerTheme.colors.foreground,
    },
    shiftVenue: {
        marginTop: 8,
        fontSize: 16,
        color: workerTheme.colors.secondary,
    },
    shiftAddress: {
        marginTop: 4,
        fontSize: 16,
        color: workerTheme.colors.mutedForeground,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 12,
    },
    orgBadge: {
        maxWidth: "62%",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
    },
    orgBadgeDot: {
        width: 8,
        height: 8,
        borderRadius: 999,
    },
    orgBadgeText: {
        flexShrink: 1,
        fontSize: 12,
        fontWeight: "600",
        color: workerTheme.colors.foreground,
    },
    needsAttentionBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: workerTheme.colors.surfaceMuted,
    },
    needsAttentionText: {
        fontSize: 12,
        fontWeight: "600",
        color: workerTheme.colors.secondary,
    },
    conflictBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: workerTheme.colors.primarySoft,
    },
    conflictText: {
        flex: 1,
        fontSize: 13,
        color: workerTheme.colors.foreground,
    },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    emptyTitle: {
        marginTop: 14,
        fontSize: 18,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
        textAlign: "center",
    },
    emptySubtitle: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
        color: workerTheme.colors.mutedForeground,
        textAlign: "center",
    },
    listContent: {
        paddingBottom: 28,
    },
    listContentWithBanner: {
        paddingBottom: 132,
    },
    activeBanner: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 18,
        paddingVertical: 16,
        backgroundColor: workerTheme.colors.secondary,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
    },
    activeIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.6)",
        alignItems: "center",
        justifyContent: "center",
    },
    activeContent: {
        flex: 1,
    },
    activeTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: workerTheme.colors.white,
    },
    activeLine: {
        marginTop: 3,
        fontSize: 14,
        color: workerTheme.colors.surfaceMuted,
    },
});
