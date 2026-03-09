import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api } from "../../../lib/api";
import { workerTheme } from "../../../lib/theme";

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

    const handleSubmit = async () => {
        if (!reason || reason.length < 5) {
            Alert.alert("Error", "Please provide a valid reason with at least 5 characters.");
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
        <View style={s.container}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: "Request Adjustment",
                    headerStyle: { backgroundColor: workerTheme.colors.background },
                    headerTintColor: workerTheme.colors.foreground,
                    headerShadowVisible: false,
                }}
            />

            <ScrollView contentContainerStyle={s.content}>
                <View style={s.hero}>
                    <Text style={s.eyebrow}>Shift correction</Text>
                    <Text style={s.heroTitle}>{shiftTitle || "Shift"}</Text>
                    <Text style={s.heroBody}>
                        Submit the times you actually worked and explain what needs to be corrected.
                    </Text>
                </View>

                <View style={s.card}>
                    <Text style={s.sectionTitle}>Reason</Text>
                    <TextInput
                        style={s.textArea}
                        value={reason}
                        onChangeText={setReason}
                        placeholder="For example: forgot to clock out, clock-in banner did not appear, GPS check failed..."
                        placeholderTextColor={workerTheme.colors.subtleForeground}
                        multiline
                        numberOfLines={5}
                        textAlignVertical="top"
                    />
                </View>

                <View style={s.card}>
                    <Text style={s.sectionTitle}>Corrected times</Text>

                    <TouchableOpacity style={s.timeButton} onPress={() => setShowPicker("in")}>
                        <Text style={s.timeLabel}>Clock in</Text>
                        <Text style={s.timeValue}>
                            {clockIn ? clockIn.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "No change"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={s.timeButton} onPress={() => setShowPicker("out")}>
                        <Text style={s.timeLabel}>Clock out</Text>
                        <Text style={s.timeValue}>
                            {clockOut ? clockOut.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "No change"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {showPicker ? (
                    <DateTimePicker
                        value={new Date()}
                        mode="time"
                        display="default"
                        onChange={onDateChange}
                    />
                ) : null}
            </ScrollView>

            <SafeAreaView edges={["bottom"]} style={s.footer}>
                <TouchableOpacity
                    style={[s.submitButton, loading ? s.submitButtonDisabled : null]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color={workerTheme.colors.white} />
                    ) : (
                        <Text style={s.submitText}>Submit request</Text>
                    )}
                </TouchableOpacity>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: workerTheme.colors.background,
    },
    content: {
        padding: 20,
        paddingBottom: 28,
        gap: 16,
    },
    hero: {
        paddingTop: 8,
    },
    eyebrow: {
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: workerTheme.colors.primary,
        marginBottom: 10,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
        marginBottom: 8,
    },
    heroBody: {
        fontSize: 14,
        lineHeight: 21,
        color: workerTheme.colors.mutedForeground,
    },
    card: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.surface,
        padding: 16,
        gap: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
    },
    textArea: {
        minHeight: 120,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.surfaceInset,
        padding: 14,
        fontSize: 15,
        color: workerTheme.colors.foreground,
    },
    timeButton: {
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.surfaceInset,
        paddingHorizontal: 14,
    },
    timeLabel: {
        fontSize: 14,
        fontWeight: "600",
        color: workerTheme.colors.foreground,
    },
    timeValue: {
        fontSize: 14,
        color: workerTheme.colors.secondary,
    },
    footer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.background,
    },
    submitButton: {
        minHeight: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: workerTheme.colors.primary,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitText: {
        fontSize: 16,
        fontWeight: "700",
        color: workerTheme.colors.white,
    },
});
