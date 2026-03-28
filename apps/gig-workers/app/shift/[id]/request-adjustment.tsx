import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";

import { Button } from "heroui-native/button";
import { Description } from "heroui-native/description";
import { FieldError } from "heroui-native/field-error";
import { Input } from "heroui-native/input";
import { Label } from "heroui-native/label";
import { Spinner } from "heroui-native/spinner";
import { TextField } from "heroui-native/text-field";

import { PageHeader } from "../../../components/ui/page-header";
import { Screen } from "../../../components/ui/screen";
import { SectionCard } from "../../../components/ui/section-card";
import { SectionTitle } from "../../../components/ui/section-title";
import { api } from "../../../lib/api";

export default function RequestAdjustmentScreen() {
    const { id, shiftTitle, assignmentId } = useLocalSearchParams<{
        id: string;
        shiftTitle?: string;
        assignmentId?: string;
    }>();
    const router = useRouter();

    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [clockIn, setClockIn] = useState<Date | null>(null);
    const [clockOut, setClockOut] = useState<Date | null>(null);
    const [showPicker, setShowPicker] = useState<"in" | "out" | null>(null);
    const [reasonError, setReasonError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!reason || reason.length < 5) {
            setReasonError("Please provide a valid reason with at least 5 characters.");
            return;
        }

        try {
            setLoading(true);

            await api.adjustments.create({
                shiftAssignmentId: assignmentId || id,
                reason,
                requestedClockIn: clockIn?.toISOString(),
                requestedClockOut: clockOut?.toISOString(),
            });

            Alert.alert("Success", "Adjustment request submitted.", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to submit request");
        } finally {
            setLoading(false);
        }
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        const pickerType = showPicker;
        setShowPicker(null);

        if (event.type === "dismissed" || !selectedDate) {
            return;
        }

        if (pickerType === "in") {
            setClockIn(selectedDate);
        }

        if (pickerType === "out") {
            setClockOut(selectedDate);
        }
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <Screen>
                <PageHeader title="Request adjustment" showBack onBack={() => router.back()} />

                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}>
                    <View className="gap-2">
                        <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-accent">
                            Shift correction
                        </Text>
                        <Text className="text-2xl font-semibold text-foreground">
                            {shiftTitle || "Shift"}
                        </Text>
                        <Text className="text-sm leading-6 text-muted">
                            Submit the times you actually worked and explain what needs to be corrected.
                        </Text>
                    </View>

                    <View className="gap-3">
                        <SectionTitle label="Reason" />
                        <SectionCard>
                            <TextField isRequired isInvalid={Boolean(reasonError)}>
                                <Label>What needs to be corrected?</Label>
                                <Input
                                    value={reason}
                                    onChangeText={(value) => {
                                        setReason(value);
                                        setReasonError(null);
                                    }}
                                    placeholder="Forgot to clock out, location check failed, banner did not appear..."
                                    multiline
                                    numberOfLines={5}
                                    textAlignVertical="top"
                                    className="min-h-32"
                                />
                                <Description>Include enough detail for your manager to review the adjustment.</Description>
                                {reasonError ? <FieldError>{reasonError}</FieldError> : null}
                            </TextField>
                        </SectionCard>
                    </View>

                    <View className="gap-3">
                        <SectionTitle label="Corrected times" />
                        <SectionCard>
                            <Button variant="secondary" onPress={() => setShowPicker("in")}>
                                <Button.Label>
                                    Clock in:{" "}
                                    {clockIn
                                        ? clockIn.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                                        : "No change"}
                                </Button.Label>
                            </Button>

                            <Button variant="secondary" onPress={() => setShowPicker("out")}>
                                <Button.Label>
                                    Clock out:{" "}
                                    {clockOut
                                        ? clockOut.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                                        : "No change"}
                                </Button.Label>
                            </Button>
                        </SectionCard>
                    </View>

                    {showPicker ? (
                        <DateTimePicker
                            value={new Date()}
                            mode="time"
                            display="default"
                            onChange={onDateChange}
                        />
                    ) : null}

                    <Button onPress={handleSubmit} isDisabled={loading}>
                        {loading ? <Spinner size="sm" /> : null}
                        <Button.Label>{loading ? "Submitting" : "Submit request"}</Button.Label>
                    </Button>
                </ScrollView>
            </Screen>
        </>
    );
}
