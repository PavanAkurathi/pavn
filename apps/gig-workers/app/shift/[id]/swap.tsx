import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { Button } from "heroui-native/button";
import { Input } from "heroui-native/input";
import { Label } from "heroui-native/label";
import { Spinner } from "heroui-native/spinner";
import { TextField } from "heroui-native/text-field";

import { EmptyState } from "../../../components/ui/empty-state";
import { Icon } from "../../../components/ui/icon";
import { LoadingScreen } from "../../../components/ui/loading-screen";
import { PageHeader } from "../../../components/ui/page-header";
import { Screen } from "../../../components/ui/screen";
import { SectionCard } from "../../../components/ui/section-card";
import { SectionTitle } from "../../../components/ui/section-title";
import { api, SwapCandidatesResponse } from "../../../lib/api";

type Person = SwapCandidatesResponse["people"][number];

export default function SwapShiftScreen() {
    const { id, title, when } = useLocalSearchParams<{ id: string; title?: string; when?: string }>();
    const router = useRouter();
    const [people, setPeople] = useState<Person[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [picked, setPicked] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        api.requests
            .swapCandidates(id)
            .then((result) => setPeople(result.people))
            .catch((e) => {
                setError(e instanceof Error ? e.message : "Couldn't load coworkers");
                setPeople([]);
            });
    }, [id]);

    const send = async () => {
        if (!picked) return;
        setSending(true);
        try {
            const result = await api.requests.swap(id, picked, note.trim() || undefined);
            Toast.show({ type: "success", text1: result.message });
            router.back();
        } catch (e) {
            Toast.show({ type: "error", text1: e instanceof Error ? e.message : "Couldn't send the offer" });
        } finally {
            setSending(false);
        }
    };

    if (people === null) return <LoadingScreen label="Finding coworkers" />;

    const free = people.filter((p) => !p.conflict);

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <Screen>
                <PageHeader title="Offer your shift" subtitle={[title, when].filter(Boolean).join(" · ")} showBack onBack={() => router.back()} />
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }} keyboardShouldPersistTaps="handled">
                    {people.length === 0 ? (
                        <EmptyState
                            icon="people-outline"
                            title="No one to offer it to"
                            description={error ?? "Nobody else here works this role yet. You can still ask your manager to take you off it."}
                        />
                    ) : (
                        <>
                            <Text className="text-sm leading-6 text-muted">
                                They get a notification and can accept or decline. You stay on the shift until it&apos;s final.
                            </Text>
                            <View className="gap-3">
                                <SectionTitle label={free.length ? `Free then (${free.length})` : "Coworkers"} />
                                <SectionCard>
                                    {people.map((p) => {
                                        const selected = picked === p.id;
                                        return (
                                            <Pressable
                                                key={p.id}
                                                disabled={Boolean(p.conflict)}
                                                onPress={() => setPicked(p.id)}
                                                accessibilityRole="radio"
                                                accessibilityState={{ checked: selected, disabled: Boolean(p.conflict) }}
                                                className="flex-row items-center gap-3 py-1"
                                            >
                                                <Icon
                                                    name={selected ? "radio-button-on" : "radio-button-off"}
                                                    size={22}
                                                    className={p.conflict ? "text-muted" : "text-accent"}
                                                />
                                                <View className="flex-1">
                                                    <Text className={p.conflict ? "text-[15px] text-muted" : "text-[15px] font-medium text-foreground"}>
                                                        {p.name}
                                                    </Text>
                                                    {p.conflict ? <Text className="text-xs text-muted">{p.conflict}</Text> : null}
                                                </View>
                                            </Pressable>
                                        );
                                    })}
                                </SectionCard>
                            </View>
                            <SectionCard>
                                <TextField>
                                    <Label>Message (optional)</Label>
                                    <Input value={note} onChangeText={setNote} placeholder="Can you cover me? I'll take one of yours." maxLength={500} />
                                </TextField>
                            </SectionCard>
                            <Button onPress={() => void send()} isDisabled={!picked || sending}>
                                {sending ? <Spinner size="sm" /> : null}
                                <Button.Label>Send offer</Button.Label>
                            </Button>
                        </>
                    )}
                </ScrollView>
            </Screen>
        </>
    );
}
