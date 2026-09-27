import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import Toast from "react-native-toast-message";

import { Button } from "heroui-native/button";
import { Chip } from "heroui-native/chip";
import { Description } from "heroui-native/description";
import { Input } from "heroui-native/input";
import { Label } from "heroui-native/label";
import { Spinner } from "heroui-native/spinner";
import { TextField } from "heroui-native/text-field";

import { PageHeader } from "../../components/ui/page-header";
import { Screen } from "../../components/ui/screen";
import { SectionCard } from "../../components/ui/section-card";
import { SectionTitle } from "../../components/ui/section-title";
import { api, WorkerOrg } from "../../lib/api";

type Picker = "startDate" | "endDate" | "startTime" | "endTime";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dateLabel = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const timeLabel = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function atTime(day: Date, time: Date) {
    const out = new Date(day);
    out.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return out;
}

function startOfTomorrow() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function hour(h: number) {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d;
}

export default function NewTimeOffScreen() {
    const router = useRouter();
    const [allDay, setAllDay] = useState(true);
    const [startDate, setStartDate] = useState(startOfTomorrow);
    const [endDate, setEndDate] = useState(startOfTomorrow);
    const [startTime, setStartTime] = useState(() => hour(9));
    const [endTime, setEndTime] = useState(() => hour(13));
    const [reason, setReason] = useState("");
    const [picker, setPicker] = useState<Picker | null>(null);
    const [orgs, setOrgs] = useState<WorkerOrg[]>([]);
    const [chosen, setChosen] = useState<Set<string> | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.worker
            .getOrganizations()
            .then((result) => setOrgs(result.organizations))
            .catch(() => setOrgs([]));
    }, []);

    const values: Record<Picker, Date> = { startDate, endDate, startTime, endTime };
    const onPick = (_event: unknown, value?: Date) => {
        const which = picker;
        if (Platform.OS !== "ios") setPicker(null);
        if (!value || !which) return;
        setError(null);
        if (which === "startDate") {
            setStartDate(value);
            if (value > endDate) setEndDate(value);
        } else if (which === "endDate") setEndDate(value);
        else if (which === "startTime") setStartTime(value);
        else setEndTime(value);
    };

    const submit = async () => {
        let body: Parameters<typeof api.requests.timeOff>[0];
        if (allDay) {
            if (ymd(endDate) < ymd(startDate)) return setError("The last day is before the first.");
            body = { allDay: true, startDate: ymd(startDate), endDate: ymd(endDate) };
        } else {
            const start = atTime(startDate, startTime);
            let end = atTime(startDate, endTime);
            // "10pm to 2am" runs past midnight.
            if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
            body = { allDay: false, startTime: start.toISOString(), endTime: end.toISOString() };
        }
        if (reason.trim()) body.reason = reason.trim();
        if (chosen && chosen.size && chosen.size < orgs.length) body.organizationIds = [...chosen];

        setSaving(true);
        try {
            const result = await api.requests.timeOff(body);
            Toast.show({ type: "success", text1: result.message });
            router.back();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't send that");
        } finally {
            setSaving(false);
        }
    };

    const toggleOrg = (id: string) => {
        const next = new Set(chosen ?? orgs.map((o) => o.id));
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setChosen(next);
    };
    const isChosen = (id: string) => !chosen || chosen.has(id);

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <Screen>
                <PageHeader title="Time off" subtitle="Your manager answers in the app" showBack onBack={() => router.back()} />
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }} keyboardShouldPersistTaps="handled">
                    <View className="gap-3">
                        <SectionTitle label="When" />
                        <SectionCard>
                            <View className="flex-row items-center justify-between">
                                <Text className="text-[15px] font-medium text-foreground">All day</Text>
                                <Switch value={allDay} onValueChange={setAllDay} accessibilityLabel="All day" />
                            </View>
                            <Button variant="secondary" onPress={() => setPicker("startDate")}>
                                <Button.Label>
                                    {allDay ? "From" : "Day"}: {dateLabel(startDate)}
                                </Button.Label>
                            </Button>
                            {allDay ? (
                                <Button variant="secondary" onPress={() => setPicker("endDate")}>
                                    <Button.Label>Until: {dateLabel(endDate)}</Button.Label>
                                </Button>
                            ) : (
                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <Button variant="secondary" onPress={() => setPicker("startTime")}>
                                            <Button.Label>From {timeLabel(startTime)}</Button.Label>
                                        </Button>
                                    </View>
                                    <View className="flex-1">
                                        <Button variant="secondary" onPress={() => setPicker("endTime")}>
                                            <Button.Label>To {timeLabel(endTime)}</Button.Label>
                                        </Button>
                                    </View>
                                </View>
                            )}
                        </SectionCard>
                    </View>

                    {picker ? (
                        <DateTimePicker
                            value={values[picker]}
                            mode={picker === "startDate" || picker === "endDate" ? "date" : "time"}
                            minimumDate={picker === "endDate" ? startDate : picker === "startDate" ? new Date() : undefined}
                            display={Platform.OS === "ios" ? "inline" : "default"}
                            onChange={onPick}
                        />
                    ) : null}
                    {picker && Platform.OS === "ios" ? (
                        <Button variant="secondary" onPress={() => setPicker(null)}>
                            <Button.Label>Done</Button.Label>
                        </Button>
                    ) : null}

                    <View className="gap-3">
                        <SectionTitle label="Reason" />
                        <SectionCard>
                            <TextField>
                                <Label>Anything your manager should know (optional)</Label>
                                <Input
                                    value={reason}
                                    onChangeText={setReason}
                                    placeholder="Family wedding, exam, appointment…"
                                    multiline
                                    numberOfLines={3}
                                    maxLength={500}
                                    textAlignVertical="top"
                                    className="min-h-20"
                                />
                                <Description>Only your managers see this.</Description>
                            </TextField>
                        </SectionCard>
                    </View>

                    {orgs.length > 1 ? (
                        <View className="gap-3">
                            <SectionTitle label="Send to" />
                            <View className="flex-row flex-wrap gap-2">
                                {orgs.map((org) => (
                                    <Pressable key={org.id} onPress={() => toggleOrg(org.id)} accessibilityRole="checkbox" accessibilityState={{ checked: isChosen(org.id) }}>
                                        <Chip variant={isChosen(org.id) ? "primary" : "secondary"} color={isChosen(org.id) ? "accent" : "default"}>
                                            <Chip.Label>{org.name}</Chip.Label>
                                        </Chip>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    ) : null}

                    {error ? <Text className="text-sm text-danger">{error}</Text> : null}

                    <Button onPress={() => void submit()} isDisabled={saving || (chosen !== null && chosen.size === 0)}>
                        {saving ? <Spinner size="sm" /> : null}
                        <Button.Label>{saving ? "Sending" : "Send request"}</Button.Label>
                    </Button>
                </ScrollView>
            </Screen>
        </>
    );
}
