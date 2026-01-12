import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";

export default function PastShiftDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    // Mock Logic: ID 'p1' is Recent (<12h), others are Old (>12h)
    const isRecent = id === 'p1';

    // State for Correction Modal
    const [isModalVisible, setModalVisible] = useState(false);
    const [reason, setReason] = useState("");
    const [correctStart, setCorrectStart] = useState("7:00 PM");
    const [correctEnd, setCorrectEnd] = useState("3:00 AM");
    const [correctBreak, setCorrectBreak] = useState("30m"); // Added Break Time

    // Mock Data based on ID
    const shiftData = {
        role: "Bartender",
        venue: isRecent ? "NYE Gala" : "Tech Conf",
        date: isRecent ? "Yesterday, Jan 7" : "Nov 15, 2025",
        earnings: isRecent ? "$400.00" : "$360.00",
        hours: isRecent ? "8.0" : "8.0",
        rate: isRecent ? "$50/hr" : "$45/hr",
        clockIn: "7:00 PM",
        clockOut: "3:00 AM",
        break: "30m (Paid)"
    };

    const handleRequestCorrection = () => {
        setModalVisible(true);
    };

    const submitCorrection = () => {
        if (!reason.trim()) {
            Alert.alert("Missing Info", "Please provide a reason for the correction.");
            return;
        }

        // Use timeout to simulate API call
        setModalVisible(false);
        setTimeout(() => {
            Alert.alert(
                "Request Sent",
                "Your manager has been notified. You will receive an update once reviewed.",
                [{ text: "OK" }]
            );
        }, 500);
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                headerShown: false,
                presentation: 'modal',
            }} />

            {/* Header */}
            <SafeAreaView edges={['top']} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Shift Receipt</Text>
                <View style={{ width: 40 }} />
            </SafeAreaView>

            <ScrollView style={styles.content}>
                {/* HERO: Earnings */}
                <View style={styles.heroSection}>
                    <Text style={styles.heroLabel}>Total Earnings</Text>
                    <Text style={styles.heroAmount}>{shiftData.earnings}</Text>
                    <View style={styles.heroBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                        <Text style={styles.heroBadgeText}>COMPLETED</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Timesheet Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Timesheet Record</Text>
                    <View style={styles.timesheetCard}>
                        <View style={styles.row}>
                            <View>
                                <Text style={styles.label}>Clock In</Text>
                                <Text style={styles.value}>{shiftData.clockIn}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.label}>Clock Out</Text>
                                <Text style={styles.value}>{shiftData.clockOut}</Text>
                            </View>
                        </View>
                        <View style={styles.hairline} />
                        <View style={styles.row}>
                            <Text style={styles.label}>Total Hours</Text>
                            <Text style={styles.value}>{shiftData.hours} hrs</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Break</Text>
                            <Text style={styles.value}>{shiftData.break}</Text>
                        </View>
                    </View>
                </View>

                {/* Data Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Shift Details</Text>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Role</Text>
                        <Text style={styles.detailValue}>{shiftData.role}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Venue</Text>
                        <Text style={styles.detailValue}>{shiftData.venue}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date</Text>
                        <Text style={styles.detailValue}>{shiftData.date}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Rate</Text>
                        <Text style={styles.detailValue}>{shiftData.rate}</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Footer: Correction Logic */}
            <SafeAreaView edges={['bottom']} style={styles.footer}>
                {isRecent ? (
                    <View>
                        <Text style={styles.windowText}>
                            Correction window open (closes in 24h of shift end)
                        </Text>
                        <TouchableOpacity style={styles.button} onPress={handleRequestCorrection}>
                            <Text style={styles.buttonText}>Request Correction</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.lockedContainer}>
                        <Ionicons name="lock-closed" size={20} color="#666" />
                        <Text style={styles.lockedText}>
                            Correction window closed. Contact manager for changes.
                        </Text>
                    </View>
                )}
            </SafeAreaView>

            {/* Correction Form Modal */}
            <Modal
                visible={isModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Correct Timesheet</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Actual Clock In</Text>
                            <TextInput
                                style={styles.input}
                                value={correctStart}
                                onChangeText={setCorrectStart}
                                placeholder="7:00 PM"
                                placeholderTextColor="#444"
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Actual Clock Out</Text>
                            <TextInput
                                style={styles.input}
                                value={correctEnd}
                                onChangeText={setCorrectEnd}
                                placeholder="3:00 AM"
                                placeholderTextColor="#444"
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Break Duration</Text>
                            <TextInput
                                style={styles.input}
                                value={correctBreak}
                                onChangeText={setCorrectBreak}
                                placeholder="30m"
                                placeholderTextColor="#444"
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Reason for Correction</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={reason}
                                onChangeText={setReason}
                                placeholder="e.g. Forgot to clock out, machine broke..."
                                placeholderTextColor="#444"
                                multiline
                            />
                        </View>

                        <TouchableOpacity style={styles.submitButton} onPress={submitCorrection}>
                            <Text style={styles.submitButtonText}>Submit Request</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#111',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    closeButton: {
        padding: 8,
        marginLeft: -8,
    },
    content: {
        flex: 1,
    },
    // Hero
    heroSection: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    heroLabel: {
        color: '#888',
        fontSize: 14,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    heroAmount: {
        color: '#4CAF50',
        fontSize: 48,
        fontWeight: '800',
        marginBottom: 12,
        letterSpacing: -1,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    heroBadgeText: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    divider: {
        height: 8,
        backgroundColor: '#050505',
        marginBottom: 24,
    },
    // Sections
    section: {
        paddingHorizontal: 24,
        marginBottom: 32,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    timesheetCard: {
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#222',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 4,
    },
    hairline: {
        height: 1,
        backgroundColor: '#222',
        marginVertical: 16,
    },
    label: {
        color: '#666',
        fontSize: 14,
        marginBottom: 4,
    },
    value: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    // Details
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#111',
    },
    detailLabel: {
        color: '#888',
        fontSize: 15,
    },
    detailValue: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
    },
    // Footer
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#111',
        backgroundColor: '#050505',
    },
    windowText: {
        color: '#888',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 12,
    },
    button: {
        backgroundColor: '#222',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    lockedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    lockedText: {
        color: '#666',
        fontSize: 13,
        textAlign: 'center',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#151515',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        borderTopWidth: 1,
        borderTopColor: '#333',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },
    formGroup: {
        marginBottom: 20,
    },
    formLabel: {
        color: '#888',
        fontSize: 14,
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#222',
        color: '#fff',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    submitButton: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    submitButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    },
});
