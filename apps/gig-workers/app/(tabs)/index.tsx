import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    SectionList,
    Text,
    View,
} from "react-native";
import { useRouter } from "expo-router";

import { Card } from "heroui-native/card";
import { Chip } from "heroui-native/chip";

import { ShiftCard } from "../../components/ShiftCard";
import { EmptyState } from "../../components/ui/empty-state";
import { LoadingScreen } from "../../components/ui/loading-screen";
import { PageHeader } from "../../components/ui/page-header";
import { Screen } from "../../components/ui/screen";
import { Icon } from "../../components/ui/icon";
import { api, ConflictInfo, SessionExpiredError, WorkerOrg, WorkerShift } from "../../lib/api";
import { workerTheme } from "../../lib/theme";
import { registerGeofences } from "../../services/geofencing";

const ORG_COLORS = workerTheme.roleColors;

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

type ViewMode = "schedule" | "history";

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

function FilterChip({
    label,
    active = false,
    onPress,
}: {
    label: string;
    active?: boolean;
    onPress?: () => void;
}) {
    return (
        <Chip
            onPress={onPress}
            variant={active ? "primary" : "secondary"}
            color={active ? "accent" : "default"}
            size="md"
        >
            <Chip.Label>{label}</Chip.Label>
        </Chip>
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

    const orgColorMap = useMemo(() => {
        const map = new Map<string, string>();
        organizations.forEach((org, index) => {
            map.set(org.id, ORG_COLORS[index % ORG_COLORS.length]);
        });
        return map;
    }, [organizations]);

    const conflictMap = useMemo(() => {
        const map = new Map<string, ConflictInfo>();
        conflicts.forEach((conflict) => {
            if (!map.has(conflict.shiftId)) {
                map.set(conflict.shiftId, conflict);
            }
        });
        return map;
    }, [conflicts]);

    const inProgressShift = shifts.find((shift) => isInProgress(shift));
    const futureShifts = shifts.filter((shift) => !isInProgress(shift) && new Date(shift.endTime) > new Date());
    const historyShifts = shifts.filter((shift) => !isInProgress(shift));
    const shiftsToRender = viewMode === "history" ? historyShifts : futureShifts;
    const sections = buildSections(shiftsToRender);
    const totalConflicts = conflicts.length;
    const selectedOrganization = organizations.find((organization) => organization.id === selectedOrgId);

    if (loading && !refreshing) {
        return <LoadingScreen label="Loading your shifts" />;
    }

    return (
        <Screen>
            <PageHeader
                title="My shifts"
                subtitle={
                    selectedOrganization
                        ? `Showing ${selectedOrganization.name}`
                        : `Showing all orgs${organizations.length ? ` · ${organizations.length}` : ""}`
                }
                actions={[
                    {
                        icon: "notifications-outline",
                        label: "Notifications",
                        onPress: () => router.push("/notifications"),
                    },
                    {
                        icon: "person-circle-outline",
                        label: "Profile",
                        onPress: () => router.push("/(tabs)/profile"),
                    },
                ]}
            />

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}
                style={{ maxHeight: 58 }}
            >
                <FilterChip label="All orgs" active={!selectedOrgId} onPress={() => setSelectedOrgId(null)} />
                {organizations.map((org) => (
                    <FilterChip
                        key={org.id}
                        label={org.name}
                        active={selectedOrgId === org.id}
                        onPress={() => setSelectedOrgId(selectedOrgId === org.id ? null : org.id)}
                    />
                ))}
                <FilterChip label="Upcoming" active={viewMode === "schedule"} onPress={() => setViewMode("schedule")} />
                <FilterChip label="History" active={viewMode === "history"} onPress={() => setViewMode("history")} />
                {totalConflicts > 0 ? <FilterChip label={`Conflicts: ${totalConflicts}`} /> : null}
            </ScrollView>

            {sections.length === 0 ? (
                <View className="flex-1 px-5 pt-4">
                    <EmptyState
                        icon="calendar-clear-outline"
                        title={viewMode === "history" ? "No shift history yet" : "No upcoming shifts"}
                        description={
                            viewMode === "history"
                                ? "Completed and past shifts will show here."
                                : "New shifts will appear here across all organizations."
                        }
                    />
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => `${item.id}:${item.assignmentId}`}
                    stickySectionHeadersEnabled={false}
                    renderSectionHeader={({ section }) => (
                        <View className="px-5 pb-3 pt-4">
                            <Text className="text-lg font-semibold text-foreground">{section.title}</Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <View className="px-5 pb-4">
                            <ShiftCard
                                shift={item}
                                conflict={conflictMap.get(item.id)}
                                orgColor={orgColorMap.get(item.organization.id) || workerTheme.roleColors[5]}
                                onPress={() => router.push(`/shift/${item.id}`)}
                            />
                        </View>
                    )}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    contentContainerStyle={{
                        paddingBottom: inProgressShift ? 144 : 48,
                    }}
                />
            )}

            {inProgressShift ? (
                <Pressable
                    onPress={() => router.push(`/shift/${inProgressShift.id}`)}
                    className="absolute bottom-5 left-5 right-5"
                >
                    <Card variant="secondary" className="rounded-[30px]">
                        <Card.Body className="flex-row items-center gap-4 px-5 py-4">
                            <View className="h-12 w-12 items-center justify-center rounded-[18px] bg-accent">
                                <Icon name="time-outline" size={24} className="text-accent-foreground" />
                            </View>

                            <View className="flex-1 gap-1">
                                <Text className="text-sm font-semibold text-foreground">Shift in progress</Text>
                                <Text className="text-sm text-foreground" numberOfLines={1}>
                                    {inProgressShift.title} / {inProgressShift.organization.name}
                                </Text>
                                <Text className="text-xs text-muted" numberOfLines={1}>
                                    {inProgressShift.location.name}
                                </Text>
                            </View>

                            <Icon name="chevron-forward" size={22} className="text-foreground" />
                        </Card.Body>
                    </Card>
                </Pressable>
            ) : null}
        </Screen>
    );
}
