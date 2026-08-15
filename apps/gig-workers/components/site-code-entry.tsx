import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { Button } from "heroui-native/button";
import { Spinner } from "heroui-native/spinner";

import { api } from "../lib/api";

interface SiteCodeEntryProps {
    shiftId: string;
    orgId?: string;
    onClockedIn: () => void;
}

const CODE_LENGTH = 4;

/**
 * The way in when the phone cannot prove where it is.
 *
 * Four digits the supervisor says out loud, typed by someone who is probably
 * cold and holding a phone in one hand — so it is one field, numeric keypad,
 * large type, and no formatting to fight with. It says plainly that the manager
 * will see this was used, because a worker should never discover that later.
 */
export function SiteCodeEntry({ shiftId, orgId, onClockedIn }: SiteCodeEntryProps) {
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await api.geofence.clockInWithCode({ shiftId, code }, orgId);
            onClockedIn();
        } catch (e) {
            setError(
                e instanceof Error && e.message
                    ? e.message
                    : "That did not work. Ask your supervisor to read the code again.",
            );
            setCode("");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View className="gap-3 rounded-xl border border-border bg-background p-4">
            <View className="gap-1">
                <Text className="text-base font-semibold text-foreground">Site code</Text>
                <Text className="text-sm text-muted">
                    Four digits from your supervisor. Your manager sees that you clocked in this way.
                </Text>
            </View>

            <TextInput
                value={code}
                onChangeText={(next) => {
                    setCode(next.replace(/\D/g, "").slice(0, CODE_LENGTH));
                    setError(null);
                }}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={CODE_LENGTH}
                autoFocus
                accessibilityLabel="Site code, four digits"
                placeholder="0000"
                placeholderTextColor="#94A3B8"
                className="rounded-lg border border-border bg-background px-4 py-3 text-center text-3xl font-bold tracking-[12px] text-foreground"
            />

            {error ? <Text className="text-sm font-medium text-danger">{error}</Text> : null}

            <Button onPress={submit} isDisabled={code.length !== CODE_LENGTH || submitting}>
                {submitting ? <Spinner size="sm" /> : null}
                <Button.Label>Clock in with code</Button.Label>
            </Button>
        </View>
    );
}
