import { useCallback, useState } from "react";
import { Alert, RefreshControl, SectionList, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { Button } from "heroui-native/button";
import { Card } from "heroui-native/card";
import { Chip } from "heroui-native/chip";

import { EmptyState } from "../../components/ui/empty-state";
import { LoadingScreen } from "../../components/ui/loading-screen";
import { PageHeader } from "../../components/ui/page-header";
import { Screen } from "../../components/ui/screen";
import { api, SessionExpiredError, WorkerRequest } from "../../lib/api";
import { shiftWhen, timeOffWhen } from "../../lib/request-format";

const KIND: Record<WorkerRequest["kind"], string> = {
    claim: "Open shift",
    drop: "Drop",
    swap: "Swap",
    time_off: "Time off",
};

const STATUS: Record<WorkerRequest["status"], { label: string; color: "default" | "accent" | "success" | "danger" | "warning" }> = {
    pending_peer: { label: "Waiting on coworker", color: "warning" },
    pending_manager: { label: "Waiting on manager", color: "warning" },
    pending: { label: "Waiting on manager", color: "warning" },
    approved: { label: "Approved", color: "success" },
    declined: { label: "Declined", color: "danger" },
    cancelled: { label: "Cancelled", color: "default" },
    expired: { label: "Expired", color: "default" },
};

function title(r: WorkerRequest) {
    const role = r.shift?.role ?? "a shift";
    switch (r.kind) {
        case "claim":
            return `Pick up ${role}`;
        case "drop":
            return `Drop ${role}`;
        case "swap":
            return r.direction === "received" ? `${r.otherPerson?.name ?? "A coworker"} offered you ${role}` : `Swap ${role} with ${r.otherPerson?.name ?? "a coworker"}`;
        case "time_off":
            return "Time off";
    }
}

function RequestCard({
    request: r,
    busy,
    onAct,
}: {
    request: WorkerRequest;
    busy: boolean;
    onAct: (action: "accept" | "decline" | "cancel") => void;
}) {
    const when = r.shift ? shiftWhen(r.shift) : r.timeOff ? timeOffWhen(r.timeOff) : null;
    const place = [r.shift?.locationName, r.organization.name].filter(Boolean).join(" · ");
    const status = STATUS[r.status];
    return (
        <Card className="rounded-[28px]">
            <Card.Body className="gap-3 p-5">
                <View className="flex-row items-center justify-between gap-3">
                    <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-muted">{KIND[r.kind]}</Text>
                    <Chip size="sm" variant="soft" color={status.color}>
                        <Chip.Label>{status.label}</Chip.Label>
                    </Chip>
                </View>
                <View className="gap-1">
                    <Text className="text-lg font-semibold text-foreground">{title(r)}</Text>
                    {when ? <Text className="text-[15px] font-medium text-foreground">{when}</Text> : null}
                    <Text className="text-sm text-muted" numberOfLines={1}>
                        {place}
                    </Text>
                </View>
                {r.note ? <Text className="text-sm italic text-muted">“{r.note}”</Text> : null}
                {r.managerNote ? <Text className="text-sm text-foreground">Manager: {r.managerNote}</Text> : null}

                {r.canRespond ? (
                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <Button variant="secondary" onPress={() => onAct("decline")} isDisabled={busy}>
                                <Button.Label>Decline</Button.Label>
                            </Button>
                        </View>
                        <View className="flex-1">
                            <Button onPress={() => onAct("accept")} isDisabled={busy}>
                                <Button.Label>Accept</Button.Label>
                            </Button>
                        </View>
                    </View>
                ) : null}
                {r.canCancel ? (
                    <Button variant="secondary" onPress={() => onAct("cancel")} isDisabled={busy}>
                        <Button.Label>{r.kind === "time_off" && r.status === "approved" ? "Cancel time off" : "Cancel request"}</Button.Label>
                    </Button>
                ) : null}
            </Card.Body>
        </Card>
    );
}

export default function RequestsScreen() {
    const router = useRouter();
    const [requests, setRequests] = useState<WorkerRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const result = await api.requests.list();
            setRequests(result.requests);
        } catch (error) {
            if (!(error instanceof SessionExpiredError)) {
                Toast.show({ type: "error", text1: "Couldn't load requests", text2: error instanceof Error ? error.message : undefined });
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // On every visit, so what was just sent from the time-off form or a shift shows.
    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    const run = async (r: WorkerRequest, action: "accept" | "decline" | "cancel") => {
        setBusyId(r.id);
        try {
            const result = await api.requests.act(r.id, action);
            Toast.show({ type: "success", text1: result.message });
        } catch (error) {
            Toast.show({ type: "error", text1: error instanceof Error ? error.message : "Couldn't do that" });
        } finally {
            setBusyId(null);
            void load();
        }
    };

    const act = (r: WorkerRequest, action: "accept" | "decline" | "cancel") => {
        if (action === "accept") {
            Alert.alert("Take this shift?", `${r.shift ? shiftWhen(r.shift) : ""}. It goes on your schedule once it's final.`, [
                { text: "Not now", style: "cancel" },
                { text: "Accept", onPress: () => void run(r, action) },
            ]);
        } else if (action === "cancel") {
            Alert.alert("Cancel this request?", undefined, [
                { text: "Keep it", style: "cancel" },
                { text: "Cancel request", style: "destructive", onPress: () => void run(r, action) },
            ]);
        } else {
            void run(r, action);
        }
    };

    if (loading) return <LoadingScreen label="Loading your requests" />;

    const waitingOnYou = requests.filter((r) => r.canRespond);
    const open = requests.filter((r) => !r.canRespond && ["pending_peer", "pending_manager", "pending"].includes(r.status));
    const done = requests.filter((r) => !r.canRespond && !open.includes(r));
    const sections = [
        { title: "Needs your answer", data: waitingOnYou },
        { title: "Waiting", data: open },
        { title: "Decided", data: done },
    ].filter((s) => s.data.length);

    return (
        <Screen>
            <PageHeader
                title="Requests"
                subtitle="Time off, swaps, drops and shifts you asked for"
                actions={[{ icon: "add", label: "Ask for time off", onPress: () => router.push("/time-off/new") }]}
            />
            {sections.length === 0 ? (
                <View className="flex-1 px-5 pt-4">
                    <EmptyState
                        icon="swap-horizontal-outline"
                        title="No requests yet"
                        description="Ask for time off here. To drop a shift or hand it to a coworker, open the shift from My shifts."
                        actionLabel="Ask for time off"
                        onAction={() => router.push("/time-off/new")}
                    />
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    stickySectionHeadersEnabled={false}
                    renderSectionHeader={({ section }) => (
                        <View className="px-5 pb-3 pt-4">
                            <Text className="text-lg font-semibold text-foreground">{section.title}</Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <View className="px-5 pb-4">
                            <RequestCard request={item} busy={busyId === item.id} onAct={(action) => act(item, action)} />
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
