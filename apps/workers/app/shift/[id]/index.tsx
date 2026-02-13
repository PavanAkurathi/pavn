
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Animated, Easing } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useRef } from "react";
import { api, WorkerShift } from "../../../lib/api";
import { useGeofence } from "../../../hooks/useGeofence";

const { width } = Dimensions.get("window");

export default function ShiftDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    // Data State
    const [shift, setShift] = useState<WorkerShift | null>(null);
    const [loading, setLoading] = useState(true);

    // Geofence Hook
    const { clockIn, clockOut, loading: geofenceLoading, error: geofenceError } = useGeofence();

    // UI State
    const [locationStatus, setLocationStatus] = useState<'idle' | 'checking' | 'verified' | 'failed' | 'override'>('checking');

    // Animation
    const slideAnim = useRef(new Animated.Value(-150)).current;
    const [bannerData, setBannerData] = useState<{ title: string; message: string; type: 'info' | 'success' | 'warning' } | null>(null);

    useEffect(() => {
        loadShift();
    }, [id]);

    const loadShift = async () => {
        try {
            setLoading(true);
            const data = await api.shifts.getById(id as string);
            setShift(data);
        } catch (error: any) {
            Alert.alert("Error", "Failed to load shift details");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleClockIn = async () => {
        if (!shift) return;
        try {
            await clockIn(shift.id, {
                latitude: shift.location.latitude,
                longitude: shift.location.longitude,
                geofenceRadius: shift.location.geofenceRadius
            });
            showBanner("Success", "Clocked in successfully", "success");
            loadShift(); // Refresh to update status
        } catch (error: any) {
            Alert.alert("Clock In Failed", error.message);
        }
    };

    const handleClockOut = async () => {
        if (!shift) return;
        try {
            await clockOut(shift.id, {
                latitude: shift.location.latitude,
                longitude: shift.location.longitude,
                geofenceRadius: shift.location.geofenceRadius
            });
            showBanner("Success", "Clocked out successfully", "success");
            loadShift();
        } catch (error: any) {
            Alert.alert("Clock Out Failed", error.message);
        }
    };

    const showBanner = (title: string, message: string, type: 'info' | 'success' | 'warning') => {
        setBannerData({ title, message, type });
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        setTimeout(() => {
            Animated.timing(slideAnim, {
                toValue: -150,
                duration: 400,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }).start(() => setBannerData(null));
        }, 4000);
    };

    const getStatusColor = () => {
        if (shift?.status === 'in-progress') return '#4CAF50';
        if (shift?.status === 'completed') return '#007AFF';
        return '#888';
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    if (!shift) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#fff' }}>Shift not found</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                    <Text style={{ color: '#007AFF' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const isClockedIn = !!shift.timesheet.clockIn;
    const isClockedOut = !!shift.timesheet.clockOut;
    const isSlideEnabled = true; // In real app, bind to locationStatus === 'verified'

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                headerShown: false,
                presentation: 'card'
            }} />

            {/* Banner */}
            {bannerData && (
                <Animated.View style={[
                    styles.softBanner,
                    { transform: [{ translateY: slideAnim }] },
                    { borderLeftColor: bannerData.type === 'success' ? '#4CAF50' : '#FFC107' }
                ]}>
                    <SafeAreaView edges={['top']}>
                        <View style={styles.bannerContent}>
                            <Text style={styles.bannerTitle}>{bannerData.title}</Text>
                            <Text style={styles.bannerMessage}>{bannerData.message}</Text>
                        </View>
                    </SafeAreaView>
                </Animated.View>
            )}

            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            {/* Request Adjustment Button */}
            <TouchableOpacity
                style={styles.helpButton}
                onPress={() => router.push({
                    pathname: `/shift/${id}/request-adjustment`,
                    params: { shiftTitle: shift?.title }
                })}
            >
                <Ionicons name="help-circle-outline" size={24} color="#fff" />
            </TouchableOpacity>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingTop: 80 }}>
                {/* Header */}
                <View style={styles.headerContent}>
                    <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{shift.status.toUpperCase()}</Text>
                        </View>
                    </View>
                    <Text style={styles.role}>{shift.title}</Text>
                    <Text style={styles.venue}>{shift.location.name}</Text>
                    <Text style={styles.subtitle}>{new Date(shift.startTime).toLocaleString()}</Text>
                </View>

                <View style={styles.divider} />

                {/* Status Section */}
                {isClockedIn && !isClockedOut && (
                    <View style={[styles.successBanner, { borderColor: '#4CAF50' }]}>
                        <Ionicons name="time" size={24} color="#4CAF50" />
                        <View style={styles.successTextContainer}>
                            <Text style={[styles.successTitle, { color: '#4CAF50' }]}>Currently Working</Text>
                            <Text style={styles.successSub}>Clocked in at {new Date(shift.timesheet.clockIn!).toLocaleTimeString()}</Text>
                        </View>
                    </View>
                )}

                {isClockedOut && (
                    <View style={[styles.successBanner, { borderColor: '#007AFF' }]}>
                        <Ionicons name="checkmark-done" size={24} color="#007AFF" />
                        <View style={styles.successTextContainer}>
                            <Text style={[styles.successTitle, { color: '#007AFF' }]}>Shift Completed</Text>
                            <Text style={styles.successSub}>
                                {new Date(shift.timesheet.clockIn!).toLocaleTimeString()} - {new Date(shift.timesheet.clockOut!).toLocaleTimeString()}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Geofence Map Placeholder */}
                <View style={[styles.mapPlaceholder, { borderColor: getStatusColor() }]}>
                    <Text style={{ color: '#666' }}>Map View Placeholder</Text>
                    <Text style={{ color: '#444', fontSize: 10 }}>{shift.location.latitude}, {shift.location.longitude}</Text>
                </View>

            </ScrollView>

            {/* Footer Actions */}
            <SafeAreaView edges={['bottom']} style={styles.footer}>
                {!isClockedIn && !isClockedOut && (
                    <View>
                        {/* Location Status Mock */}
                        <View style={styles.locationStatusContainer}>
                            <Text style={styles.statusTextPending}>Verifying location...</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.sliderContainer, isSlideEnabled ? styles.sliderEnabled : styles.sliderDisabled]}
                            disabled={!isSlideEnabled || geofenceLoading}
                            onPress={handleClockIn}
                        >
                            {geofenceLoading ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.slideTextEnabled}>Slide to Clock In</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {isClockedIn && !isClockedOut && (
                    <TouchableOpacity
                        style={[styles.sliderContainer, { backgroundColor: '#FF5252' }]}
                        disabled={geofenceLoading}
                        onPress={handleClockOut}
                    >
                        {geofenceLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={[styles.slideTextEnabled, { color: '#fff' }]}>End Shift</Text>
                        )}
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },
    backButton: { position: 'absolute', top: 60, left: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
    helpButton: { position: 'absolute', top: 60, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
    content: { flex: 1 },
    headerContent: { padding: 24, paddingTop: 80 },
    badgeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    badge: { backgroundColor: '#333', padding: 6, borderRadius: 4 },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    role: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    venue: { fontSize: 16, color: '#ccc' },
    subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
    divider: { height: 1, backgroundColor: '#333', marginVertical: 16 },
    successBanner: { flexDirection: 'row', padding: 16, backgroundColor: '#111', borderRadius: 8, borderWidth: 1, marginHorizontal: 24, marginBottom: 16, alignItems: 'center' },
    successTextContainer: { marginLeft: 12 },
    successTitle: { fontWeight: 'bold', marginBottom: 4 },
    successSub: { color: '#ccc', fontSize: 12 },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#333', backgroundColor: '#000' },
    sliderContainer: { height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' },
    sliderEnabled: { backgroundColor: '#4CAF50' },
    sliderDisabled: { backgroundColor: '#333' },
    slideTextEnabled: { color: '#000', fontWeight: 'bold', fontSize: 16 },
    locationStatusContainer: { alignItems: 'center', marginBottom: 12 },
    statusTextPending: { color: '#666', fontSize: 12 },
    softBanner: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#222', zIndex: 100, borderLeftWidth: 4 },
    bannerContent: { padding: 16 },
    bannerTitle: { color: '#fff', fontWeight: 'bold' },
    bannerMessage: { color: '#ccc' },
    mapPlaceholder: { height: 150, marginHorizontal: 24, backgroundColor: '#111', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed' }
});
