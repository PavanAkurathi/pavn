import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Alert as HeroAlert } from "heroui-native/alert";
import { Button } from "heroui-native/button";
import { Card } from "heroui-native/card";
import { Chip } from "heroui-native/chip";
import { Spinner } from "heroui-native/spinner";

import { EmptyState } from "../../../components/ui/empty-state";
import { LoadingScreen } from "../../../components/ui/loading-screen";
import { PageHeader } from "../../../components/ui/page-header";
import { Screen } from "../../../components/ui/screen";
import { Icon } from "../../../components/ui/icon";
import { SectionTitle } from "../../../components/ui/section-title";
import { api, WorkerShift } from "../../../lib/api";
import { useGeofence } from "../../../hooks/useGeofence";

type LocationStatus = "checking" | "verified" | "failed" | "optional" | "not_required";

const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const fmtDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    if (date.toDateString() === now.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
};

const formatTimer = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const formatHours = (value: number | null): string => {
    if (value === null) return "—";
    const h = Math.floor(value);
    const m = Math.round((value - h) * 60);
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hrs`;
    return `${h} hrs ${m} min`;
};

function useRunningTimer(clockInIso: string | undefined) {
    const [elapsed, setElapsed] = useState(0);
    const interval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!clockInIso) return;
        const start = new Date(clockInIso).getTime();
        const tick = () => setElapsed(Date.now() - start);
        tick();
        interval.current = setInterval(tick, 1000);
        return () => {
            if (interval.current) clearInterval(interval.current);
        };
    }, [clockInIso]);

    return elapsed;
}

function InfoRow({
    icon,
    label,
    value,
    tag,
    highlight = false,
}: {
    icon: string;
    label: string;
    value: string;
    tag?: string;
    highlight?: boolean;
}) {
    return (
        <View className="flex-row gap-3">
            <View className="mt-0.5">
                <Icon name={icon as any} size={18} className="text-muted" />
            </View>
            <View className="flex-1 gap-1">
                <Text className="text-xs text-muted">{label}</Text>
                <View className="flex-row items-center gap-2">
                    <Text className={highlight ? "text-[15px] font-medium text-success" : "text-[15px] font-medium text-foreground"}>
                        {value}
                    </Text>
                    {tag ? (
                        <Chip size="sm" variant="soft" color="default">
                            <Chip.Label>{tag}</Chip.Label>
                        </Chip>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

export default function ShiftDetailScreen() {
    const { id, orgId } = useLocalSearchParams<{
        id: string;
        orgId?: string;
    }>();
    const router = useRouter();
    const [shift, setShift] = useState<WorkerShift | null>(null);
    const [loading, setLoading] = useState(true);
    const { clockIn, clockOut, loading: geoLoading } = useGeofence();
    const [locStatus, setLocStatus] = useState<LocationStatus>("checking");

    const isClockedIn = !!shift?.timesheet.clockIn;
    const isClockedOut = !!shift?.timesheet.clockOut;
    const isActive = isClockedIn && !isClockedOut;
    const elapsed = useRunningTimer(isActive ? shift?.timesheet.clockIn : undefined);
    const attendancePolicy = shift?.attendanceVerificationPolicy || "strict_geofence";
    const requiresOnSite = attendancePolicy === "strict_geofence";

    const lateMinutes = shift?.timesheet.clockIn
        ? Math.max(
            0,
            Math.round(
                (new Date(shift.timesheet.clockIn).getTime() - new Date(shift.startTime).getTime()) / 60000
            )
        )
        : 0;

    useEffect(() => {
        void loadShift();
    }, [id]);

    useEffect(() => {
        if (!shift || isClockedIn) return;
        void verifyLocation();
    }, [shift?.id, shift?.attendanceVerificationPolicy, isClockedIn]);

    const loadShift = async () => {
        try {
            setLoading(true);
            const data = await api.shifts.getById(id, orgId);
            setShift(data);
        } catch {
            Alert.alert("Error", "Failed to load shift");
        } finally {
            setLoading(false);
        }
    };

    const verifyLocation = async () => {
        const policy = shift?.attendanceVerificationPolicy || "strict_geofence";
        if (policy === "none") {
            setLocStatus("not_required");
            return;
        }

        setLocStatus("checking");
        try {
            const { LocationService } = require("../../../services/location");
            const loc = await LocationService.getCurrentLocation();
            if (!loc || !shift?.location.latitude || !shift?.location.longitude) {
                setLocStatus(policy === "strict_geofence" ? "failed" : "optional");
                return;
            }

            const R = 6371e3;
            const p1 = (loc.coords.latitude * Math.PI) / 180;
            const p2 = (shift.location.latitude * Math.PI) / 180;
            const dp = ((shift.location.latitude - loc.coords.latitude) * Math.PI) / 180;
            const dl = ((shift.location.longitude - loc.coords.longitude) * Math.PI) / 180;
            const a =
                Math.sin(dp / 2) ** 2 +
                Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            if (dist <= (shift.location.geofenceRadius || 150)) {
                setLocStatus("verified");
            } else {
                setLocStatus(policy === "strict_geofence" ? "failed" : "optional");
            }
        } catch {
            setLocStatus(policy === "strict_geofence" ? "failed" : "optional");
        }
    };

    const handleClockIn = async () => {
        if (!shift) return;
        try {
            await clockIn(shift.id, {
                latitude: shift.location.latitude,
                longitude: shift.location.longitude,
                geofenceRadius: shift.location.geofenceRadius,
                attendanceVerificationPolicy: shift.attendanceVerificationPolicy,
                orgId: shift.organization.id,
            });
            await loadShift();
        } catch (error: any) {
            Alert.alert("Clock In Failed", error.message);
        }
    };

    const handleClockOut = async () => {
        if (!shift) return;
        try {
            await clockOut(shift.id, {
                latitude: shift.location.latitude,
                longitude: shift.location.longitude,
                geofenceRadius: shift.location.geofenceRadius,
                attendanceVerificationPolicy: shift.attendanceVerificationPolicy,
                orgId: shift.organization.id,
            });
            await loadShift();
        } catch (error: any) {
            Alert.alert("Clock Out Failed", error.message);
        }
    };

    const openDirections = () => {
        if (!shift?.location.latitude || !shift?.location.longitude) return;
        const lat = shift.location.latitude;
        const lng = shift.location.longitude;
        const url =
            Platform.select({
                ios: `maps://app?daddr=${lat},${lng}`,
                android: `google.navigation:q=${lat},${lng}`,
            }) || `https://maps.google.com/?daddr=${lat},${lng}`;
        void Linking.openURL(url);
    };

    if (loading) {
        return <LoadingScreen label="Loading shift details" />;
    }

    if (!shift) {
        return (
            <Screen className="justify-center px-5">
                <EmptyState
                    icon="calendar-clear-outline"
                    title="Shift not found"
                    description="This shift is no longer available or could not be loaded."
                    actionLabel="Go back"
                    onAction={() => router.back()}
                />
            </Screen>
        );
    }

    const canClockIn = !isClockedIn && !isClockedOut && (!requiresOnSite || locStatus === "verified");

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <Screen>
                <PageHeader
                    title={shift.title}
                    subtitle={shift.organization.name}
                    showBack
                    onBack={() => router.back()}
                    actions={
                        isClockedOut
                            ? [
                                {
                                    icon: "create-outline",
                                    label: "Request adjustment",
                                    onPress: () =>
                                        router.push({
                                            pathname: `/shift/${id}/request-adjustment`,
                                            params: {
                                                shiftTitle: shift.title,
                                                assignmentId: shift.assignmentId,
                                                orgId: shift.organization.id,
                                            },
                                        }),
                                },
                            ]
                            : undefined
                    }
                />

                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 16 }}>
                    <View className="gap-1">
                        <Text className="text-sm font-medium text-secondary">{shift.location.name}</Text>
                        {shift.location.address ? (
                            <Text className="text-sm text-muted">{shift.location.address}</Text>
                        ) : null}
                    </View>

                    <View className="flex-row">
                        {isActive ? (
                            <Chip variant="soft" color="success">
                                <Chip.Label>In progress</Chip.Label>
                            </Chip>
                        ) : isClockedOut ? (
                            <Chip variant="soft" color="default">
                                <Chip.Label>Completed</Chip.Label>
                            </Chip>
                        ) : (
                            <Chip variant="soft" color="accent">
                                <Chip.Label>{shift.status.toUpperCase()}</Chip.Label>
                            </Chip>
                        )}
                    </View>

                    <Card className="rounded-[28px]">
                        <Card.Body className="gap-5 p-5">
                            <InfoRow icon="time-outline" label="Scheduled" value={`${fmt(shift.startTime)} - ${fmt(shift.endTime)}`} />
                            <InfoRow
                                icon="calendar-outline"
                                label="Date"
                                value={fmtDate(shift.startTime)}
                                tag={new Date(shift.startTime).toDateString() === new Date().toDateString() ? "today" : undefined}
                            />
                            <InfoRow icon="hourglass-outline" label="Scheduled hours" value={formatHours(shift.hours.scheduled)} />
                            {shift.hours.breakMinutes > 0 ? (
                                <InfoRow icon="cafe-outline" label="Break" value={`${shift.hours.breakMinutes} min (unpaid)`} />
                            ) : null}
                            {shift.hours.worked !== null ? (
                                <InfoRow icon="checkmark-done-outline" label="Hours worked" value={formatHours(shift.hours.worked)} highlight />
                            ) : null}
                        </Card.Body>
                    </Card>

                    {isActive ? (
                        <Card variant="secondary" className="rounded-[28px]">
                            <Card.Body className="items-center gap-3 px-5 py-6">
                                <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-success">
                                    Time on shift
                                </Text>
                                <Text className="text-[40px] font-semibold text-foreground">
                                    {formatTimer(elapsed)}
                                </Text>
                                {locStatus === "verified" ? (
                                    <View className="flex-row items-center gap-2">
                                        <Icon name="wifi" size={14} className="text-success" />
                                        <Text className="text-xs text-success">Close to location</Text>
                                    </View>
                                ) : null}
                            </Card.Body>
                        </Card>
                    ) : null}

                    {lateMinutes > 0 && lateMinutes < 120 ? (
                        <HeroAlert status="warning">
                            <HeroAlert.Indicator />
                            <HeroAlert.Content>
                                <HeroAlert.Title>Late arrival</HeroAlert.Title>
                                <HeroAlert.Description>Clocked in {lateMinutes} min late.</HeroAlert.Description>
                            </HeroAlert.Content>
                        </HeroAlert>
                    ) : null}

                    {isClockedOut ? (
                        <Card className="rounded-[28px]">
                            <Card.Body className="gap-5 p-5">
                                <InfoRow icon="log-in-outline" label="Clock in" value={fmt(shift.timesheet.clockIn!)} />
                                <InfoRow icon="log-out-outline" label="Clock out" value={fmt(shift.timesheet.clockOut!)} />
                            </Card.Body>
                        </Card>
                    ) : null}

                    {shift.timesheetFlags.missingClockIn ? (
                        <HeroAlert status="warning">
                            <HeroAlert.Indicator />
                            <HeroAlert.Content>
                                <HeroAlert.Title>Missing clock-in</HeroAlert.Title>
                                <HeroAlert.Description>No clock-in was recorded. Your manager will update this.</HeroAlert.Description>
                            </HeroAlert.Content>
                        </HeroAlert>
                    ) : null}

                    {shift.timesheetFlags.missingClockOut ? (
                        <HeroAlert status="warning">
                            <HeroAlert.Indicator />
                            <HeroAlert.Content>
                                <HeroAlert.Title>Missing clock-out</HeroAlert.Title>
                                <HeroAlert.Description>No clock-out was recorded. Your manager will update this.</HeroAlert.Description>
                            </HeroAlert.Content>
                        </HeroAlert>
                    ) : null}

                    {shift.location.latitude && shift.location.longitude ? (
                        <View className="gap-3">
                            <SectionTitle label="Location" />
                            <Card className="rounded-[28px]">
                                <Card.Body className="gap-4 p-5">
                                    <View className="items-center gap-2 rounded-[22px] bg-default px-4 py-8">
                                        <Icon name="location-outline" size={30} className="text-accent" />
                                        <Text className="text-sm font-medium text-foreground">
                                            {shift.location.latitude.toFixed(4)}, {shift.location.longitude.toFixed(4)}
                                        </Text>
                                        <Text className="text-xs text-muted">Directions open in your device map app.</Text>
                                    </View>
                                    <Button variant="secondary" onPress={openDirections}>
                                        <Icon name="navigate-outline" size={16} className="text-foreground" />
                                        <Button.Label>Get directions</Button.Label>
                                    </Button>
                                </Card.Body>
                            </Card>
                        </View>
                    ) : null}

                    {isClockedOut ? (
                        <Card className="rounded-[28px]">
                            <Card.Body className="gap-2 p-5">
                                <Text className="text-sm font-semibold text-foreground">Hours adjustments</Text>
                                <Text className="text-sm leading-6 text-muted">
                                    You have 12 hours after the shift to request any adjustments to your working hours.
                                </Text>
                            </Card.Body>
                        </Card>
                    ) : null}
                </ScrollView>

                <SafeAreaView edges={["bottom"]} className="border-t border-border bg-background px-4 pb-4 pt-3">
                    {!isClockedIn && !isClockedOut ? (
                        <View className="gap-3">
                            {locStatus === "checking" ? (
                                <HeroAlert>
                                    <HeroAlert.Indicator />
                                    <HeroAlert.Content>
                                        <HeroAlert.Title>Verifying location</HeroAlert.Title>
                                        <HeroAlert.Description>Checking whether you are close enough to clock in.</HeroAlert.Description>
                                    </HeroAlert.Content>
                                </HeroAlert>
                            ) : null}

                            {locStatus === "verified" ? (
                                <HeroAlert status="success">
                                    <HeroAlert.Indicator />
                                    <HeroAlert.Content>
                                        <HeroAlert.Title>Ready to clock in</HeroAlert.Title>
                                        <HeroAlert.Description>
                                            {requiresOnSite
                                                ? "You are at the venue and can clock in now."
                                                : "You are near the venue and ready to clock in."}
                                        </HeroAlert.Description>
                                    </HeroAlert.Content>
                                </HeroAlert>
                            ) : null}

                            {locStatus === "optional" ? (
                                <HeroAlert>
                                    <HeroAlert.Indicator />
                                    <HeroAlert.Content>
                                        <HeroAlert.Title>Flexible on-site</HeroAlert.Title>
                                        <HeroAlert.Description>
                                            You can clock in away from the venue. Your manager may review it later.
                                        </HeroAlert.Description>
                                    </HeroAlert.Content>
                                </HeroAlert>
                            ) : null}

                            {locStatus === "not_required" ? (
                                <HeroAlert>
                                    <HeroAlert.Indicator />
                                    <HeroAlert.Content>
                                        <HeroAlert.Title>Location check disabled</HeroAlert.Title>
                                        <HeroAlert.Description>
                                            This organization does not require location verification for clock-in.
                                        </HeroAlert.Description>
                                    </HeroAlert.Content>
                                </HeroAlert>
                            ) : null}

                            {locStatus === "failed" ? (
                                <HeroAlert status="danger">
                                    <HeroAlert.Indicator />
                                    <HeroAlert.Content>
                                        <HeroAlert.Title>On-site required</HeroAlert.Title>
                                        <HeroAlert.Description>You must be at the venue to clock in.</HeroAlert.Description>
                                    </HeroAlert.Content>
                                </HeroAlert>
                            ) : null}

                            <Button onPress={handleClockIn} isDisabled={!canClockIn || geoLoading}>
                                {geoLoading ? <Spinner size="sm" /> : null}
                                <Button.Label>Clock in</Button.Label>
                            </Button>

                            {locStatus === "failed" && requiresOnSite ? (
                                <Button variant="secondary" onPress={() => void verifyLocation()}>
                                    <Button.Label>Retry location check</Button.Label>
                                </Button>
                            ) : null}
                        </View>
                    ) : null}

                    {isActive ? (
                        <Button variant="danger" onPress={handleClockOut} isDisabled={geoLoading}>
                            {geoLoading ? <Spinner size="sm" /> : null}
                            <Button.Label>Clock out</Button.Label>
                        </Button>
                    ) : null}
                </SafeAreaView>
            </Screen>
        </>
    );
}
