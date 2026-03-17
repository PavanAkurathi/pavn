import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, Platform } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useRef } from "react";
import { api, WorkerShift } from "../../../lib/api";
import { useGeofence } from "../../../hooks/useGeofence";
import { workerTheme } from "../../../lib/theme";

// =============================================================================
// HELPERS
// =============================================================================

const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const tmr = new Date(now); tmr.setDate(now.getDate() + 1);
    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === tmr.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
};

const formatTimer = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const formatHours = (n: number | null): string => {
    if (n === null) return "—";
    const h = Math.floor(n);
    const m = Math.round((n - h) * 60);
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hrs`;
    return `${h} hrs ${m} min`;
};

// =============================================================================
// RUNNING TIMER HOOK
// =============================================================================

function useRunningTimer(clockInIso: string | undefined) {
    const [elapsed, setElapsed] = useState(0);
    const interval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!clockInIso) return;
        const start = new Date(clockInIso).getTime();
        const tick = () => setElapsed(Date.now() - start);
        tick();
        interval.current = setInterval(tick, 1000);
        return () => { if (interval.current) clearInterval(interval.current); };
    }, [clockInIso]);

    return elapsed;
}

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function ShiftDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [shift, setShift] = useState<WorkerShift | null>(null);
    const [loading, setLoading] = useState(true);
    const { clockIn, clockOut, loading: geoLoading } = useGeofence();
    const [locStatus, setLocStatus] = useState<'checking' | 'verified' | 'failed'>('checking');

    const isClockedIn = !!shift?.timesheet.clockIn;
    const isClockedOut = !!shift?.timesheet.clockOut;
    const isActive = isClockedIn && !isClockedOut;
    const elapsed = useRunningTimer(isActive ? shift?.timesheet.clockIn : undefined);

    // Late calculation
    const lateMinutes = shift?.timesheet.clockIn
        ? Math.max(0, Math.round((new Date(shift.timesheet.clockIn).getTime() - new Date(shift.startTime).getTime()) / 60000))
        : 0;

    useEffect(() => { loadShift(); }, [id]);

    useEffect(() => {
        if (!shift || isClockedIn) return;
        verifyLocation();
    }, [shift?.id]);

    const loadShift = async () => {
        try {
            setLoading(true);
            const data = await api.shifts.getById(id as string);
            setShift(data);
        } catch (e: any) {
            Alert.alert("Error", "Failed to load shift");
        } finally {
            setLoading(false);
        }
    };

    const verifyLocation = async () => {
        setLocStatus('checking');
        try {
            const { LocationService } = require('../../../services/location');
            const loc = await LocationService.getCurrentLocation();
            if (!loc || !shift?.location.latitude || !shift?.location.longitude) {
                setLocStatus('failed'); return;
            }
            const R = 6371e3;
            const p1 = loc.coords.latitude * Math.PI / 180;
            const p2 = shift.location.latitude * Math.PI / 180;
            const dp = (shift.location.latitude - loc.coords.latitude) * Math.PI / 180;
            const dl = (shift.location.longitude - loc.coords.longitude) * Math.PI / 180;
            const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            setLocStatus(dist <= (shift.location.geofenceRadius || 150) ? 'verified' : 'failed');
        } catch {
            setLocStatus('failed');
        }
    };

    const handleClockIn = async () => {
        if (!shift) return;
        try {
            await clockIn(shift.id, {
                latitude: shift.location.latitude,
                longitude: shift.location.longitude,
                geofenceRadius: shift.location.geofenceRadius,
            });
            loadShift();
        } catch (e: any) {
            Alert.alert("Clock In Failed", e.message);
        }
    };

    const handleClockOut = async () => {
        if (!shift) return;
        try {
            await clockOut(shift.id, {
                latitude: shift.location.latitude,
                longitude: shift.location.longitude,
                geofenceRadius: shift.location.geofenceRadius,
            });
            loadShift();
        } catch (e: any) {
            Alert.alert("Clock Out Failed", e.message);
        }
    };

    const openDirections = () => {
        if (!shift?.location.latitude || !shift?.location.longitude) return;
        const lat = shift.location.latitude;
        const lng = shift.location.longitude;
        const url = Platform.select({
            ios: `maps://app?daddr=${lat},${lng}`,
            android: `google.navigation:q=${lat},${lng}`,
        }) || `https://maps.google.com/?daddr=${lat},${lng}`;
        Linking.openURL(url);
    };

    if (loading) {
        return (
            <View style={s.centered}>
                <ActivityIndicator size="large" color={workerTheme.colors.primary} />
            </View>
        );
    }
    if (!shift) {
        return (
            <View style={s.centered}>
                <Text style={{ color: workerTheme.colors.mutedForeground }}>Shift not found</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
                    <Text style={{ color: workerTheme.colors.primary }}>Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const canClockIn = locStatus === 'verified' && !isClockedIn && !isClockedOut;

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Back + Adjust buttons */}
            <SafeAreaView edges={["top"]} style={s.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={s.topBtn}>
                    <Ionicons name="arrow-back" size={22} color={workerTheme.colors.foreground} />
                </TouchableOpacity>
                {isClockedOut && (
                    <TouchableOpacity
                        onPress={() =>
                            router.push({
                                pathname: `/shift/${id}/request-adjustment`,
                                params: {
                                    shiftTitle: shift.title,
                                    assignmentId: shift.assignmentId,
                                },
                            })
                        }
                        style={s.topBtn}
                    >
                        <Ionicons name="create-outline" size={22} color={workerTheme.colors.foreground} />
                    </TouchableOpacity>
                )}
            </SafeAreaView>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 100, paddingBottom: 120 }}>
                {/* Title Block */}
                <View style={s.section}>
                    <Text style={s.shiftTitle}>{shift.title}</Text>
                    <Text style={s.orgName}>{shift.organization.name}</Text>
                    <Text style={s.locationName}>{shift.location.name}</Text>
                    {shift.location.address && <Text style={s.address}>{shift.location.address}</Text>}
                </View>

                {/* Status Badge */}
                <View style={s.section}>
                    <View style={[s.statusBadge, isActive ? s.statusActive : isClockedOut ? s.statusDone : s.statusUpcoming]}>
                        <Ionicons
                            name={isActive ? "radio-button-on" : isClockedOut ? "checkmark-circle" : "time-outline"}
                            size={16}
                            color={
                                isActive
                                    ? workerTheme.colors.success
                                    : isClockedOut
                                      ? workerTheme.colors.secondary
                                      : workerTheme.colors.mutedForeground
                            }
                        />
                        <Text
                            style={[
                                s.statusText,
                                isActive
                                    ? { color: workerTheme.colors.success }
                                    : isClockedOut
                                      ? { color: workerTheme.colors.secondary }
                                      : null,
                            ]}
                        >
                            {isActive ? "In Progress" : isClockedOut ? "Completed" : shift.status.toUpperCase()}
                        </Text>
                    </View>
                </View>

                {/* Hours Info */}
                <View style={s.infoCard}>
                    <InfoRow icon="time-outline" label="Scheduled" value={`${fmt(shift.startTime)} - ${fmt(shift.endTime)}`} />
                    <InfoRow icon="calendar-outline" label="Date" value={fmtDate(shift.startTime)} tag={
                        new Date(shift.startTime).toDateString() === new Date().toDateString() ? "today" : undefined
                    } />
                    <InfoRow icon="hourglass-outline" label="Scheduled hours" value={formatHours(shift.hours.scheduled)} />
                    {shift.hours.breakMinutes > 0 && (
                        <InfoRow icon="cafe-outline" label="Break" value={`${shift.hours.breakMinutes} min (unpaid)`} />
                    )}
                    {shift.hours.worked !== null && (
                        <InfoRow icon="checkmark-done-outline" label="Hours worked" value={formatHours(shift.hours.worked)} highlight />
                    )}
                </View>

                {/* Running Timer (when clocked in) */}
                {isActive && (
                    <View style={s.timerCard}>
                        <Text style={s.timerLabel}>Time on shift</Text>
                        <Text style={s.timerValue}>{formatTimer(elapsed)}</Text>
                        {locStatus === 'verified' && (
                            <View style={s.proximityRow}>
                                <Ionicons name="wifi" size={14} color={workerTheme.colors.success} />
                                <Text style={s.proximityText}>Close to location</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Late Indicator */}
                {lateMinutes > 0 && lateMinutes < 120 && (
                    <View style={s.warningCard}>
                        <Ionicons name="warning" size={16} color={workerTheme.colors.primary} />
                        <Text style={s.warningText}>Clocked in {lateMinutes} min late</Text>
                    </View>
                )}

                {/* Clock times (completed) */}
                {isClockedOut && (
                    <View style={s.infoCard}>
                        <InfoRow icon="log-in-outline" label="Clock in" value={fmt(shift.timesheet.clockIn!)} />
                        <InfoRow icon="log-out-outline" label="Clock out" value={fmt(shift.timesheet.clockOut!)} />
                    </View>
                )}

                {/* Missing flags */}
                {shift.timesheetFlags.missingClockIn && (
                    <View style={s.warningCard}>
                        <Ionicons name="alert-circle" size={16} color={workerTheme.colors.warning} />
                        <Text style={[s.warningText, { color: workerTheme.colors.warning }]}>
                            No clock-in recorded, your manager will update this
                        </Text>
                    </View>
                )}
                {shift.timesheetFlags.missingClockOut && (
                    <View style={s.warningCard}>
                        <Ionicons name="alert-circle" size={16} color={workerTheme.colors.warning} />
                        <Text style={[s.warningText, { color: workerTheme.colors.warning }]}>
                            No clock-out recorded, your manager will update this
                        </Text>
                    </View>
                )}

                {/* Map area + Get Directions */}
                {shift.location.latitude && shift.location.longitude ? (
                    <View style={s.mapSection}>
                    <View style={s.mapPlaceholder}>
                            <Ionicons name="location" size={32} color={workerTheme.colors.primary} />
                            <Text style={s.mapCoords}>
                                {shift.location.latitude.toFixed(4)}, {shift.location.longitude.toFixed(4)}
                            </Text>
                        </View>
                        <TouchableOpacity style={s.directionsBtn} onPress={openDirections}>
                            <Ionicons
                                name="navigate-outline"
                                size={18}
                                color={workerTheme.colors.primary}
                            />
                            <Text style={s.directionsText}>Get directions</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {/* Hours adjustment info */}
                {isClockedOut && (
                    <View style={[s.infoCard, { marginTop: 16 }]}>
                        <Text style={s.adjustLabel}>Hours adjustments</Text>
                        <Text style={s.adjustText}>
                            You have 12 hours after the shift to request any adjustments to your working hours.
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Footer CTA */}
            <SafeAreaView edges={["bottom"]} style={s.footer}>
                {!isClockedIn && !isClockedOut && (
                    <View>
                        <View style={s.locRow}>
                            {locStatus === 'checking' && <Text style={s.locText}>Verifying location...</Text>}
                            {locStatus === 'verified' && (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Ionicons name="wifi" size={14} color={workerTheme.colors.success} />
                                    <Text style={[s.locText, { color: workerTheme.colors.success }]}>
                                        At venue, ready to clock in
                                    </Text>
                                </View>
                            )}
                            {locStatus === 'failed' && (
                                <Text style={[s.locText, { color: workerTheme.colors.primary }]}>
                                    You must be at the venue to clock in
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity
                            style={[s.actionBtn, canClockIn ? s.btnGreen : s.btnDisabled]}
                            disabled={!canClockIn || geoLoading}
                            onPress={handleClockIn}
                        >
                            {geoLoading ? <ActivityIndicator color={workerTheme.colors.white} /> : (
                                <Text style={canClockIn ? s.btnText : s.btnTextDisabled}>Clock in</Text>
                            )}
                        </TouchableOpacity>
                        {locStatus === 'failed' && (
                            <TouchableOpacity onPress={verifyLocation} style={{ alignItems: "center", marginTop: 8 }}>
                                <Text style={{ color: workerTheme.colors.primary, fontSize: 13 }}>
                                    Retry location check
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
                {isActive && (
                    <TouchableOpacity style={[s.actionBtn, s.btnRed]} disabled={geoLoading} onPress={handleClockOut}>
                        {geoLoading ? <ActivityIndicator color={workerTheme.colors.white} /> : (
                            <Text style={[s.btnText, { color: workerTheme.colors.white }]}>Clock out</Text>
                        )}
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        </View>
    );
}

// =============================================================================
// INFO ROW COMPONENT
// =============================================================================

function InfoRow({ icon, label, value, tag, highlight }: {
    icon: string; label: string; value: string; tag?: string; highlight?: boolean;
}) {
    return (
        <View style={s.infoRow}>
            <Ionicons
                name={icon as any}
                size={18}
                color={workerTheme.colors.mutedForeground}
                style={{ marginTop: 1 }}
            />
            <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>{label}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[s.infoValue, highlight && { color: workerTheme.colors.success }]}>
                        {value}
                    </Text>
                    {tag && <View style={s.tag}><Text style={s.tagText}>{tag}</Text></View>}
                </View>
            </View>
        </View>
    );
}

// =============================================================================
// STYLES
// =============================================================================

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: workerTheme.colors.background },
    centered: {
        flex: 1,
        backgroundColor: workerTheme.colors.background,
        justifyContent: "center",
        alignItems: "center",
    },

    topBar: {
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        flexDirection: "row", justifyContent: "space-between",
        paddingHorizontal: 16, paddingBottom: 8,
    },
    topBtn: {
        padding: 8,
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
    },

    section: { paddingHorizontal: 20, marginBottom: 16 },
    shiftTitle: { fontSize: 24, fontWeight: "700", color: workerTheme.colors.foreground, marginBottom: 4 },
    orgName: { fontSize: 15, color: workerTheme.colors.primary, marginBottom: 2 },
    locationName: { fontSize: 14, color: workerTheme.colors.secondary },
    address: { fontSize: 13, color: workerTheme.colors.mutedForeground, marginTop: 2 },

    statusBadge: {
        flexDirection: "row", alignItems: "center", gap: 6,
        alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 999, backgroundColor: workerTheme.colors.surfaceMuted,
    },
    statusActive: { backgroundColor: workerTheme.colors.successSoft },
    statusDone: { backgroundColor: workerTheme.colors.secondarySoft },
    statusUpcoming: {},
    statusText: { fontSize: 12, fontWeight: "600", color: workerTheme.colors.mutedForeground },

    infoCard: {
        marginHorizontal: 16,
        backgroundColor: workerTheme.colors.surface,
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
    },
    infoRow: { flexDirection: "row", gap: 10, paddingVertical: 8 },
    infoLabel: { fontSize: 12, color: workerTheme.colors.mutedForeground },
    infoValue: { fontSize: 15, color: workerTheme.colors.foreground, fontWeight: "500" },
    tag: {
        backgroundColor: workerTheme.colors.secondarySoft,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 999,
    },
    tagText: { fontSize: 10, color: workerTheme.colors.secondary, fontWeight: "600" },

    timerCard: {
        marginHorizontal: 16,
        backgroundColor: workerTheme.colors.successSoft,
        borderRadius: 18,
        padding: 20,
        alignItems: "center",
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#BFE3C4",
    },
    timerLabel: { fontSize: 12, color: workerTheme.colors.success, marginBottom: 4 },
    timerValue: { fontSize: 36, fontWeight: "700", color: workerTheme.colors.foreground, fontVariant: ["tabular-nums"] },
    proximityRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
    proximityText: { fontSize: 12, color: workerTheme.colors.success },

    warningCard: {
        flexDirection: "row", alignItems: "center", gap: 8,
        marginHorizontal: 16,
        backgroundColor: workerTheme.colors.warningSoft,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
    },
    warningText: { fontSize: 13, color: workerTheme.colors.primary, flex: 1 },

    mapSection: { marginHorizontal: 16, marginBottom: 12 },
    mapPlaceholder: {
        height: 140,
        backgroundColor: workerTheme.colors.surfaceMuted,
        borderRadius: 18,
        justifyContent: "center", alignItems: "center", gap: 6,
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
    },
    mapCoords: { fontSize: 11, color: workerTheme.colors.mutedForeground },
    directionsBtn: {
        flexDirection: "row", alignItems: "center", gap: 4,
        paddingVertical: 8, paddingHorizontal: 12, marginTop: 6,
    },
    directionsText: { fontSize: 14, color: workerTheme.colors.primary, fontWeight: "600" },

    adjustLabel: { fontSize: 14, fontWeight: "600", color: workerTheme.colors.foreground, marginBottom: 6 },
    adjustText: { fontSize: 13, color: workerTheme.colors.mutedForeground, lineHeight: 18 },

    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.background,
    },
    locRow: { alignItems: "center", marginBottom: 10 },
    locText: { fontSize: 12, color: workerTheme.colors.mutedForeground },
    actionBtn: {
        height: 52,
        borderRadius: 26,
        justifyContent: "center",
        alignItems: "center",
    },
    btnGreen: { backgroundColor: workerTheme.colors.success },
    btnRed: { backgroundColor: workerTheme.colors.secondary },
    btnDisabled: { backgroundColor: workerTheme.colors.surfaceMuted },
    btnText: { fontSize: 16, fontWeight: "700", color: workerTheme.colors.white },
    btnTextDisabled: { fontSize: 16, fontWeight: "600", color: workerTheme.colors.subtleForeground },
});
