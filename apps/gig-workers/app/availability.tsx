import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "heroui-native/button";
import { Card } from "heroui-native/card";
import { Chip } from "heroui-native/chip";
import { Spinner } from "heroui-native/spinner";

import { EmptyState } from "../components/ui/empty-state";
import { LoadingScreen } from "../components/ui/loading-screen";
import { PageHeader } from "../components/ui/page-header";
import { Screen } from "../components/ui/screen";
import { Icon } from "../components/ui/icon";
import { api, WorkerOrg, WorkerShift } from "../lib/api";
import { workerTheme } from "../lib/theme";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORG_COLORS = workerTheme.roleColors;

function getWeekDates(offset = 0): Date[] {
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

    const orgColorMap = useMemo(() => {
        const map = new Map<string, string>();
        orgs.forEach((org, index) => {
            map.set(org.id, ORG_COLORS[index % ORG_COLORS.length]);
        });
        return map;
    }, [orgs]);

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

    if (loading) {
        return <LoadingScreen label="Loading your availability" />;
    }

    return (
        <Screen>
            <PageHeader title="My availability" showBack onBack={() => router.back()} />

            <View className="px-5 pb-3 pt-2">
                <View className="flex-row items-center justify-between">
                    <Button variant="secondary" onPress={() => setWeekOffset((value) => value - 1)}>
                        <Icon name="chevron-back" size={18} className="text-foreground" />
                    </Button>

                    <Pressable onPress={() => setWeekOffset(0)}>
                        <Text className="text-base font-semibold text-foreground">{fmtWeekRange(weekDates)}</Text>
                    </Pressable>

                    <Button variant="secondary" onPress={() => setWeekOffset((value) => value + 1)}>
                        <Icon name="chevron-forward" size={18} className="text-foreground" />
                    </Button>
                </View>
            </View>

            {orgs.length > 1 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}
                    style={{ maxHeight: 46 }}
                >
                    {orgs.map((org) => (
                        <Chip key={org.id} variant="secondary" color="default" size="sm">
                            <View className="mr-2 h-2 w-2 rounded-full" style={{ backgroundColor: orgColorMap.get(org.id) || ORG_COLORS[0] }} />
                            <Chip.Label>{org.name}</Chip.Label>
                        </Chip>
                    ))}
                </ScrollView>
            ) : null}

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}>
                {weekDates.length === 0 ? (
                    <EmptyState
                        icon="calendar-clear-outline"
                        title="No shifts this week"
                        description="When your managers publish shifts, they will appear here."
                    />
                ) : (
                    weekDates.map((date) => {
                        const dayShifts = shiftsForDay(date);
                        const isToday = isSameDay(date, today);
                        const hasConflict = dayHasConflict(date);

                        return (
                            <Card key={date.toISOString()} variant={isToday ? "secondary" : "default"} className="rounded-[28px]">
                                <Card.Body className="gap-4 p-5">
                                    <View className="flex-row items-center justify-between">
                                        <View>
                                            <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-muted">
                                                {DAYS[date.getDay()]}
                                            </Text>
                                            <Text className="text-xl font-semibold text-foreground">{date.getDate()}</Text>
                                        </View>

                                        <View className="flex-row items-center gap-2">
                                            {isToday ? (
                                                <Chip size="sm" variant="soft" color="accent">
                                                    <Chip.Label>Today</Chip.Label>
                                                </Chip>
                                            ) : null}
                                            {hasConflict ? (
                                                <Chip size="sm" variant="soft" color="warning">
                                                    <Chip.Label>Overlap</Chip.Label>
                                                </Chip>
                                            ) : null}
                                        </View>
                                    </View>

                                    {dayShifts.length === 0 ? (
                                        <Pressable
                                            onPress={() => openBlockModal(date)}
                                            className="flex-row items-center justify-between rounded-[20px] bg-default px-4 py-3"
                                        >
                                            <Text className="text-sm font-medium text-secondary">Available</Text>
                                            <Icon name="remove-circle-outline" size={16} className="text-muted" />
                                        </Pressable>
                                    ) : (
                                        <View className="gap-3">
                                            {dayShifts.map((shift) => (
                                                <Pressable key={shift.assignmentId} onPress={() => router.push(`/shift/${shift.id}`)}>
                                                    <View
                                                        className="gap-1 rounded-[20px] border border-border bg-default px-4 py-3"
                                                        style={{
                                                            borderLeftWidth: 4,
                                                            borderLeftColor: orgColorMap.get(shift.organization.id) || ORG_COLORS[0],
                                                        }}
                                                    >
                                                        <Text className="text-sm font-semibold text-foreground">{shift.title}</Text>
                                                        <Text className="text-xs font-medium text-secondary">
                                                            {fmtTime(shift.startTime)} - {fmtTime(shift.endTime)}
                                                        </Text>
                                                        <Text className="text-xs text-muted">{shift.organization.name}</Text>
                                                    </View>
                                                </Pressable>
                                            ))}
                                        </View>
                                    )}

                                    {hasConflict ? (
                                        <View className="flex-row items-center gap-2 rounded-[18px] bg-warning-soft px-3 py-2">
                                            <Icon name="alert-circle-outline" size={13} className="text-warning" />
                                            <Text className="text-xs font-medium text-warning">Overlap to review</Text>
                                        </View>
                                    ) : null}
                                </Card.Body>
                            </Card>
                        );
                    })
                )}
            </ScrollView>

            <Modal
                visible={showBlockModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowBlockModal(false)}
            >
                <View className="flex-1 justify-center bg-black/30 px-6">
                    <Card className="rounded-[30px]">
                        <Card.Body className="gap-5 p-6">
                            <View className="gap-2">
                                <Text className="text-xl font-semibold text-foreground">Block this day?</Text>
                                <Text className="text-sm leading-6 text-muted">
                                    Mark{" "}
                                    {selectedDate?.toLocaleDateString("en-US", {
                                        weekday: "long",
                                        month: "long",
                                        day: "numeric",
                                    })}{" "}
                                    as unavailable. Your organizations will see you as unavailable for that day.
                                </Text>
                            </View>

                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <Button variant="secondary" onPress={() => setShowBlockModal(false)}>
                                        <Button.Label>Cancel</Button.Label>
                                    </Button>
                                </View>
                                <View className="flex-1">
                                    <Button onPress={handleBlockDay} isDisabled={blocking}>
                                        {blocking ? <Spinner size="sm" /> : null}
                                        <Button.Label>{blocking ? "Blocking" : "Block day"}</Button.Label>
                                    </Button>
                                </View>
                            </View>
                        </Card.Body>
                    </Card>
                </View>
            </Modal>
        </Screen>
    );
}
