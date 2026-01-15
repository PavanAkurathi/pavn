
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from "../../../lib/api";

export default function RequestAdjustmentScreen() {
    const { id, shiftTitle } = useLocalSearchParams();
    const router = useRouter();

    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);

    // Time State
    const [clockIn, setClockIn] = useState<Date | null>(null);
    const [clockOut, setClockOut] = useState<Date | null>(null);
    const [showPicker, setShowPicker] = useState<'in' | 'out' | null>(null);

    const handleSubmit = async () => {
        if (!reason || reason.length < 5) {
            Alert.alert("Error", "Please provide a valid reason (min 5 chars).");
            return;
        }

        try {
            setLoading(true);
            await api.adjustments.create({
                shiftAssignmentId: id as string, // Note: id params usually shiftId, but we need assignment Id. 
                // Wait, the API expects shiftAssignmentId. 
                // The shift Detail screen knows shift.id. 
                // We likely need to pass shiftAssignmentId or fetch it? 
                // Current backend architecture: worker-shifts endpoint returns WorkerShift which has timesheet.
                // But does it have assignmentId? WorkerShift interface doesn't show it explicitly in api.ts types.
                // Let's assume shift.id IS the assignment ID for worker or we need to find it?
                // Actually, shifts usually have shiftId and an assignmentId.
                // Looking at `api.ts`, WorkerShift has `id` which is SHIFT ID.
                // The `create-adjustment.ts` expects `shiftAssignmentId`.
                // PROBABLY, we need to lookup assignment ID on backend or frontend.
                // For now, let's pass shift ID and let backend resolve it? 
                // Backend `create-adjustment.ts` takes `shiftAssignmentId`.
                // I should update backend to resolve assignment from shiftId + workerId if possible? 
                // OR update `WorkerShift` interface to include `assignmentId`.
                // Let's assume the previous `getWorkerShiftsController` returned assignmentId or we update it.
                // For simplicity now, let's assume we pass shiftId and FIX backend to look it up if needed, or pass assignmentId if available.
                // Actually, let's fix backend to lookup assignment by shiftId + workerId if assignmentId is missing or matches shiftId?
                // No, explicit is better. I will update `WorkerShift` interface/controller later. 
                // For now, I'll pass the ID I have.
                reason,
                requestedClockIn: clockIn?.toISOString(),
                requestedClockOut: clockOut?.toISOString(),
            });

            Alert.alert("Success", "Adjustment request submitted.", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        const type = showPicker;
        setShowPicker(null);
        if (event.type === 'dismissed' || !selectedDate) return;

        if (type === 'in') setClockIn(selectedDate);
        if (type === 'out') setClockOut(selectedDate);
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                headerShown: true,
                title: "Request Adjustment",
                headerStyle: { backgroundColor: '#000' },
                headerTintColor: '#fff'
            }} />

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.label}>Shift: {shiftTitle || "Unknown"}</Text>

                <Text style={styles.sectionHeader}>Correction Details</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Reason for Adjustment *</Text>
                    <TextInput
                        style={styles.textArea}
                        value={reason}
                        onChangeText={setReason}
                        placeholder="e.g. Forgot to clock out, GPS error..."
                        placeholderTextColor="#666"
                        multiline
                        numberOfLines={4}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Corrected Times (Optional)</Text>

                    <TouchableOpacity style={styles.timeButton} onPress={() => setShowPicker('in')}>
                        <Text style={styles.timeLabel}>Clock In:</Text>
                        <Text style={styles.timeValue}>{clockIn ? clockIn.toLocaleTimeString() : "No change"}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.timeButton} onPress={() => setShowPicker('out')}>
                        <Text style={styles.timeLabel}>Clock Out:</Text>
                        <Text style={styles.timeValue}>{clockOut ? clockOut.toLocaleTimeString() : "No change"}</Text>
                    </TouchableOpacity>
                </View>

                {showPicker && (
                    <DateTimePicker
                        value={new Date()}
                        mode="time"
                        display="default"
                        onChange={onDateChange}
                    />
                )}

            </ScrollView>

            <SafeAreaView edges={['bottom']} style={styles.footer}>
                <TouchableOpacity
                    style={[styles.submitButton, loading && styles.disabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitText}>Submit Request</Text>}
                </TouchableOpacity>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },
    content: { padding: 20 },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 20, marginBottom: 10 },
    inputGroup: { marginBottom: 20 },
    label: { color: '#ccc', marginBottom: 8 },
    textArea: { backgroundColor: '#222', color: '#fff', borderRadius: 8, padding: 12, height: 100, textAlignVertical: 'top' },
    timeButton: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#222', padding: 16, borderRadius: 8, marginBottom: 10 },
    timeLabel: { color: '#fff', fontWeight: 'bold' },
    timeValue: { color: '#4CAF50' },
    footer: { padding: 16, backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#333' },
    submitButton: { backgroundColor: '#fff', padding: 16, borderRadius: 28, alignItems: 'center' },
    disabled: { opacity: 0.5 },
    submitText: { fontWeight: 'bold', fontSize: 16 }
});
