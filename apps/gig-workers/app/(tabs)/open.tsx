import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, SectionList, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { Button } from "heroui-native/button";
import { Card } from "heroui-native/card";
import { Chip } from "heroui-native/chip";
import { Spinner } from "heroui-native/spinner";

import { EmptyState } from "../../components/ui/empty-state";
import { Icon } from "../../components/ui/icon";
import { LoadingScreen } from "../../components/ui/loading-screen";
import { PageHeader } from "../../components/ui/page-header";
import { Screen } from "../../components/ui/screen";
import { api, OpenShift, SessionExpiredError } from "../../lib/api";
import { dayKey, dayTitle, shiftWhen, timeRange } from "../../lib/request-format";

function buildSections(shifts: OpenShift[]) {
    const sections = new Map<string, { title: string; data: OpenShift[] }>();
    for (const item of shifts) {
        const key = dayKey(item.shift.startTime, item.shift.timezone);
        if (!sections.has(key)) sections.set(key, { title: dayTitle(item.shift.startTime, item.shift.timezone), data: [] });
        sections.get(key)!.data.push(item);
    }
    return [...sections.values()];
}

function OpenShiftCard({
    item,
    busy,
    onClaim,
    onCancel,
}: {
    item: OpenShift;
    busy: boolean;
    onClaim: () => void;
    onCancel: () => void;
}) {
    const { shift } = item;
    const place = [shift.locationName, item.organization.name].filter(Boolean).join(" · ");
    return (
        <Card className="rounded-[28px]">
            <Card.Body className="gap-3 p-5">
                <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 gap-1">
                        <Text className="text-lg font-semibold text-foreground">{shift.role}</Text>
                        <Text className="text-[15px] font-medium text-foreground">
                            {timeRange(shift.startTime, shift.endTime, shift.timezone)}
                        </Text>
                        <Text className="text-sm text-muted" numberOfLines={1}>
                            {place}
                        </Text>
                    </View>
                    <Chip size="sm" variant="soft" color="accent">
                        <Chip.Label>{item.openSlots === 1 ? "1 spot" : `${item.openSlots} spots`}</Chip.Label>
                    </Chip>
                </View>

                {shift.eventName ? (
                    <View className="flex-row items-center gap-2">
                        <Icon name="sparkles-outline" size={14} className="text-muted" />
                        <Text className="text-sm text-muted">{shift.eventName}</Text>
                    </View>
                ) : null}
                {item.note ? <Text className="text-sm leading-5 text-muted">{item.note}</Text> : null}
                {item.breakMinutes > 0 ? <Text className="text-xs text-muted">{item.breakMinutes} min unpaid break</Text> : null}

                {item.conflict ? (
                    <View className="flex-row items-center gap-2">
                        <Icon name="alert-circle-outline" size={16} className="text-danger" />
                        <Text className="flex-1 text-sm text-danger">{item.conflict}</Text>
                    </View>
                ) : null}

                {item.pendingRequestId ? (
                    <View className="flex-row items-center justify-between gap-3">
                        <Text className="flex-1 text-sm font-medium text-foreground">Asked. Waiting on your manager.</Text>
                        <Button size="sm" variant="secondary" onPress={onCancel} isDisabled={busy}>
                            <Button.Label>Cancel</Button.Label>
                        </Button>
                    </View>
                ) : (
                    <Button onPress={onClaim} isDisabled={busy || Boolean(item.conflict)}>
                        {busy ? <Spinner size="sm" /> : null}
                        <Button.Label>{item.claimPolicy === "auto" ? "Pick up" : "Ask to pick up"}</Button.Label>
                    </Button>
                )}
            </Card.Body>
        </Card>
    );
}

export default function OpenShiftsScreen() {
    const [shifts, setShifts] = useState<OpenShift[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const result = await api.requests.openShifts();
            setShifts(result.shifts);
        } catch (error) {
            if (!(error instanceof SessionExpiredError)) {
                Toast.show({ type: "error", text1: "Couldn't load open shifts", text2: error instanceof Error ? error.message : undefined });
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const claim = (item: OpenShift) => {
        const auto = item.claimPolicy === "auto";
        Alert.alert(
            auto ? "Pick up this shift?" : "Ask to pick up this shift?",
            `${item.shift.role}, ${shiftWhen(item.shift)}${item.shift.locationName ? ` at ${item.shift.locationName}` : ""}.${
                auto ? " It's yours as soon as you confirm." : " Your manager approves it first."
            }`,
            [
                { text: "Not now", style: "cancel" },
                {
                    text: auto ? "Pick up" : "Ask",
                    onPress: async () => {
                        setBusyId(item.shift.id);
                        try {
                            const result = await api.requests.claim(item.shift.id);
                            Toast.show({ type: "success", text1: result.message });
                        } catch (error) {
                            Toast.show({ type: "error", text1: error instanceof Error ? error.message : "Couldn't pick it up" });
                        } finally {
                            setBusyId(null);
                            void load();
                        }
                    },
                },
            ],
        );
    };

    const cancel = async (item: OpenShift) => {
        if (!item.pendingRequestId) return;
        setBusyId(item.shift.id);
        try {
            await api.requests.act(item.pendingRequestId, "cancel");
            Toast.show({ type: "success", text1: "Cancelled" });
        } catch (error) {
            Toast.show({ type: "error", text1: error instanceof Error ? error.message : "Couldn't cancel" });
        } finally {
            setBusyId(null);
            void load();
        }
    };

    if (loading) return <LoadingScreen label="Finding open shifts" />;

    const sections = buildSections(shifts);

    return (
        <Screen>
            <PageHeader title="Open shifts" subtitle="Shifts you can pick up. All times are site local." />
            {sections.length === 0 ? (
                <View className="flex-1 px-5 pt-4">
                    <EmptyState
                        icon="flash-outline"
                        title="No open shifts right now"
                        description="When a manager posts a shift in one of your roles, it shows up here. Pull down to check again."
                    />
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.shift.id}
                    stickySectionHeadersEnabled={false}
                    renderSectionHeader={({ section }) => (
                        <View className="px-5 pb-3 pt-4">
                            <Text className="text-lg font-semibold text-foreground">{section.title}</Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <View className="px-5 pb-4">
                            <OpenShiftCard item={item} busy={busyId === item.shift.id} onClaim={() => claim(item)} onCancel={() => void cancel(item)} />
                        </View>
                    )}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                void load();
                            }}
                        />
                    }
                    contentContainerStyle={{ paddingBottom: 48 }}
                />
            )}
        </Screen>
    );
}
