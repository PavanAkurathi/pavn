
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Animated, Easing } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useRef } from "react";
import { registerForPushNotificationsAsync } from "../../utils/notifications";
import { api } from "../../lib/api";

const { width } = Dimensions.get("window");

export default function ShiftDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    // State
    const [locationStatus, setLocationStatus] = useState<'idle' | 'checking' | 'verified' | 'failed' | 'override'>('checking');
    const [clockInStatus, setClockInStatus] = useState<'idle' | 'success'>('idle');
    const [clockInType, setClockInType] = useState<'verified' | 'provisional'>('verified');
    const [payableStart, setPayableStart] = useState<string | null>(null);
    const [proximityStatus, setProximityStatus] = useState<'unknown' | 'far' | 'near'>('unknown');
    const [arrivalTime, setArrivalTime] = useState<string | null>(null);

    // API State
    const [isClockingIn, setIsClockingIn] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Banner State
    const [bannerData, setBannerData] = useState<{ title: string; message: string; type: 'info' | 'success' | 'warning' } | null>(null);
    const slideAnim = useRef(new Animated.Value(-150)).current; // Start hidden above screen

    // Mock Data
    const SCHEDULED_START = "4:00 PM";

    // Simulate Geofence Lifecycle (Passive Monitoring)
    // Simulate Geofence Lifecycle (Just-in-Time Verification)
    useEffect(() => {
        // Request Permissions (Just in case, though we don't spam anymore)
        registerForPushNotificationsAsync();

        // 1. Arrival Detected (Mocked: User enters Geofence)
        const arrivalTimer = setTimeout(() => {
            const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            // SILENT LOG
            console.log(`[Geofence] Worker arrived at ${time}`);

            // UNLOCK UI
            setProximityStatus('near');
            setLocationStatus('verified'); // This unlocks the slider
            setArrivalTime(time);

            // FEEDBACK (Optional: Subtle visual cue only, no Push)
            showBanner("📍 You've Arrived", "Slide to Clock In", "success");
        }, 3000);

        // 2. GPS Check Fails (Harvard Basement Scenario)
        // Only run this if we wanted to test failure, but let's keep it simple for the happy path first
        // const failTimer = setTimeout(() => {
        //     setLocationStatus('failed');
        // }, 8000);

        return () => {
            clearTimeout(arrivalTimer);
            // clearTimeout(failTimer);
        };
    }, []);

    const showBanner = (title: string, message: string, type: 'info' | 'success' | 'warning') => {
        setBannerData({ title, message, type });
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        // Auto Hide after 4s
        setTimeout(() => {
            hideBanner();
        }, 4000);
    };

    const hideBanner = () => {
        Animated.timing(slideAnim, {
            toValue: -150,
            duration: 400,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(() => setBannerData(null));
    };

    const handleManualOverride = () => {
        setLocationStatus('override');
    };

    const handleClockIn = async () => {
        if (isClockingIn) return;
        setIsClockingIn(true);

        try {
            const now = new Date();
            // Call API
            await api.shifts.clockIn(id as string, now.toISOString());

            // Success UI
            setClockInStatus('success');

            // Forensic Logic: Determine Source
            const type = locationStatus === 'verified' ? 'verified' : 'provisional';
            setClockInType(type);

            // Forensic Logic: Snap to Schedule
            // Mocking schedule time as 5:00 PM for now
            const scheduleTime = new Date();
            scheduleTime.setHours(17, 0, 0, 0); // 5:00 PM

            setPayableStart(SCHEDULED_START);
            setShowSuccessModal(true);

        } catch (error: any) {
            Alert.alert("Clock In Failed", error.message);
        } finally {
            setIsClockingIn(false);
        }
    };

    const isSlideEnabled = locationStatus === 'verified' || locationStatus === 'override';

    // UI Helpers
    const getStatusColor = () => {
        if (clockInStatus === 'success') {
            return clockInType === 'verified' ? '#4CAF50' : '#FFC107'; // Green vs Amber
        }
        return isSlideEnabled ? '#4CAF50' : '#888';
    };

    const getStatusText = () => {
        if (clockInStatus === 'success') {
            return clockInType === 'verified' ? "CLOCKED IN (VERIFIED)" : "CLOCKED IN (PROVISIONAL)";
        }
        return isSlideEnabled ? "Tap to Clock In" : "Locked";
    };

    const getBannerColor = (type: string | undefined) => {
        switch (type) {
            case 'success': return '#4CAF50';
            case 'warning': return '#FFC107';
            default: return '#007AFF'; // Info Blue
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                headerShown: false,
                presentation: 'card'
            }} />

            {/* Soft Banner (Absolute Positioned) */}
            {bannerData && (
                <Animated.View style={[
                    styles.softBanner,
                    { transform: [{ translateY: slideAnim }] },
                    { borderLeftColor: getBannerColor(bannerData.type) }
                ]}>
                    <SafeAreaView edges={['top']}>
                        <View style={styles.bannerContent}>
                            <View style={[styles.bannerIcon, { backgroundColor: getBannerColor(bannerData?.type) }]}>
                                <Ionicons
                                    name={bannerData?.type === 'success' ? "location" : "radio"}
                                    size={20}
                                    color="#fff"
                                />
                            </View>
                            <View style={styles.bannerTextContainer}>
                                <Text style={styles.bannerTitle}>{bannerData?.title}</Text>
                                <Text style={styles.bannerMessage}>{bannerData?.message}</Text>
                            </View>
                            <TouchableOpacity onPress={hideBanner}>
                                <Ionicons name="close" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </Animated.View>
            )}

            {/* Floating Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingTop: 80 }}>
                {/* Ticket Header */}
                <View style={styles.headerContent}>
                    <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>CONFIRMED</Text>
                        </View>
                        <Text style={styles.rateText}>$35.00/hr</Text>
                    </View>
                    <Text style={styles.role}>Bartender</Text>
                    <Text style={styles.venue}>Grand Ball Room</Text>
                </View>

                {/* Clock-In Success Message (Forensic Feedback) */}
                {clockInStatus === 'success' && (
                    <View style={[styles.successBanner, { borderColor: getStatusColor() }]}>
                        <Ionicons
                            name={clockInType === 'verified' ? "checkmark-circle" : "alert-circle"}
                            size={24}
                            color={getStatusColor()}
                        />
                        <View style={styles.successTextContainer}>
                            <Text style={[styles.successTitle, { color: getStatusColor() }]}>
                                {clockInType === 'verified' ? "Location Verified" : "Soft Active (Pending Verification)"}
                            </Text>
                            <Text style={styles.successSub}>
                                Payable time starts at <Text style={{ fontWeight: '700', color: '#fff' }}>{payableStart}</Text>
                            </Text>
                        </View>
                    </View>
                )}

                <View style={styles.divider} />

                {/* Shift Details Grid */}
                <View style={styles.gridSection}>
                    <View style={styles.gridItem}>
                        <Ionicons name="time-outline" size={24} color="#888" />
                        <Text style={styles.gridLabel}>Time</Text>
                        <Text style={styles.gridValue}>{SCHEDULED_START} - 12:00 AM</Text>
                        <Text style={styles.gridSub}>8 hrs • <Text style={{ color: '#4CAF50' }}>Paid Break</Text></Text>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Team Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Team (3)</Text>
                        <TouchableOpacity>
                            <Text style={styles.seeAllText}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamScroll}>
                        {/* Mock Avatars */}
                        {[1, 2, 3].map((i) => (
                            <View key={i} style={styles.teamMember}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>JD</Text>
                                </View>
                                <Text style={styles.memberName}>John</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* Secondary Actions - Only visible if NOT clocked in */}
                {clockInStatus !== 'success' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.secondaryAction}>
                            <Ionicons name="swap-horizontal" size={20} color="#fff" />
                            <Text style={styles.secondaryActionText}>Swap Shift</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.secondaryAction, styles.dangerAction]}>
                            <Ionicons name="close-circle-outline" size={20} color="#FF5252" />
                            <Text style={[styles.secondaryActionText, styles.dangerText]}>Drop Shift</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Break Action - Visible IF clocked in */}
                {clockInStatus === 'success' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.secondaryAction}>
                            <Ionicons name="cafe-outline" size={20} color="#fff" />
                            <Text style={styles.secondaryActionText}>Start Break</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Footer */}
            <SafeAreaView edges={['bottom']} style={styles.footer}>

                {/* Location Status Indicator - Only show if NOT clocked in */}
                {clockInStatus !== 'success' && (
                    <View style={styles.locationStatusContainer}>
                        {locationStatus === 'checking' && (
                            <View style={styles.statusRow}>
                                <ActivityIndicator size="small" color="#666" />
                                <Text style={styles.statusTextPending}>Verifying location...</Text>
                            </View>
                        )}
                        {locationStatus === 'verified' && (
                            <View style={styles.statusRow}>
                                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                <Text style={styles.statusTextSuccess}>Location Verified {arrivalTime ? `• Arrived ${arrivalTime}` : ''}</Text>
                            </View>
                        )}
                        {locationStatus === 'failed' && (
                            <View style={styles.statusRow}>
                                <Ionicons name="warning" size={16} color="#FF5252" />
                                <Text style={styles.statusTextError}>Weak Signal / Location Failed</Text>
                            </View>
                        )}
                        {locationStatus === 'override' && (
                            <View style={styles.statusRow}>
                                <Ionicons name="shield-checkmark" size={16} color="#FFC107" />
                                <Text style={styles.statusTextOverride}>Manual Override Active</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Slide to Clock In */}
                {clockInStatus !== 'success' && (
                    <>
                        <TouchableOpacity
                            style={[
                                styles.sliderContainer,
                                !isSlideEnabled && styles.sliderDisabled,
                                isSlideEnabled && styles.sliderEnabled
                            ]}
                            disabled={!isSlideEnabled}
                            onPress={handleClockIn}
                            activeOpacity={0.9}
                        >
                            <View style={styles.sliderTrack} />
                            {!isSlideEnabled ? (
                                <View style={[styles.sliderThumb, styles.thumbDisabled]}>
                                    <Ionicons name="lock-closed" size={24} color="#888" />
                                </View>
                            ) : (
                                // Enabled Thumb
                                <View style={styles.sliderThumb}>
                                    <Ionicons name="arrow-forward" size={24} color="#000" />
                                </View>
                            )}

                            {/* Text Container with High Z-Index/Elevation */}
                            <View style={{ position: 'absolute', width: '100%', alignItems: 'center', justifyContent: 'center', zIndex: 999, elevation: 10 }}>
                                {isSlideEnabled ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.slideTextEnabled}>{getStatusText()}</Text>
                                        <View style={{ width: 20 }} />
                                    </View>
                                ) : (
                                    <Text style={styles.slideTextDisabled}>Locked</Text>
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* Manual Override Link (Only shows if failed) */}
                        {locationStatus === 'failed' && (
                            <TouchableOpacity style={styles.overrideButton} onPress={handleManualOverride}>
                                <Text style={styles.overrideText}>I am here, force unlock</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    backButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    content: {
        flex: 1,
    },
    headerContent: {
        padding: 24,
        paddingTop: 80, // Space for back button
        paddingBottom: 16,
    },
    successBanner: {
        marginHorizontal: 24,
        marginBottom: 24,
        padding: 16,
        backgroundColor: '#111',
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    successTextContainer: {
        flex: 1,
    },
    successTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    successSub: {
        color: '#ccc',
        fontSize: 13,
        lineHeight: 18,
    },
    badgeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    badge: {
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    badgeText: {
        color: '#4CAF50',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    rateText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    role: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 4,
        letterSpacing: -0.5,
        lineHeight: 36,
    },
    venue: {
        fontSize: 18,
        color: '#ccc',
        fontWeight: '500',
    },
    divider: {
        height: 8,
        backgroundColor: '#050505',
        marginVertical: 16,
    },
    // Grid Details
    gridSection: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        gap: 24,
    },
    gridItem: {
        flex: 1,
    },
    gridLabel: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: 8,
        marginBottom: 4,
    },
    gridValue: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    gridSub: {
        color: '#888',
        fontSize: 13,
    },
    // Team
    section: {
        paddingHorizontal: 24,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    seeAllText: {
        color: '#007AFF',
        fontSize: 13,
        fontWeight: '600',
    },
    teamScroll: {
        flexGrow: 0,
    },
    teamMember: {
        alignItems: 'center',
        marginRight: 16,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#222',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 8,
    },
    avatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    memberName: {
        color: '#ccc',
        fontSize: 12,
    },
    // Actions
    actionRow: {
        flexDirection: 'row',
        padding: 24,
        gap: 16,
    },
    secondaryAction: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        backgroundColor: '#111',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#222',
    },
    dangerAction: {
        backgroundColor: 'rgba(255, 82, 82, 0.1)',
        borderColor: 'rgba(255, 82, 82, 0.3)',
    },
    secondaryActionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    dangerText: {
        color: '#FF5252',
    },
    // Footer
    footer: {
        padding: 16,
        backgroundColor: '#000',
        borderTopWidth: 1,
        borderTopColor: '#111',
        // Increased padding for status and override
        paddingBottom: 24,
    },
    locationStatusContainer: {
        marginBottom: 16,
        alignItems: 'center',
        height: 20, // Fixed height to prevent jumps
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusTextPending: {
        color: '#666',
        fontSize: 12,
        fontWeight: '500',
    },
    statusTextSuccess: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statusTextError: {
        color: '#FF5252',
        fontSize: 12,
        fontWeight: '600',
    },
    statusTextOverride: {
        color: '#FFC107',
        fontSize: 12,
        fontWeight: '600',
    },
    sliderContainer: {
        height: 60,
        borderRadius: 30,
        position: 'relative',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    sliderEnabled: {
        backgroundColor: '#4CAF50', // Green when ready
    },
    sliderDisabled: {
        backgroundColor: '#1a1a1a', // Grey when locked
        borderWidth: 1,
        borderColor: '#333',
    },
    sliderTrack: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '100%',
    },
    sliderThumb: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        left: 4,
        zIndex: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    thumbDisabled: {
        backgroundColor: '#333', // Dark thumb when disabled
    },
    slideText: {
        width: '100%',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
        zIndex: 1,
        marginLeft: 16, // Offset for thumb
    },
    slideTextEnabled: {
        color: '#000',
        fontSize: 16,
        fontWeight: '800',
    },
    slideTextDisabled: {
        color: '#666',
        textAlign: 'center',
        width: '100%',
        marginLeft: 26
    },
    // Soft Banner Styles
    softBanner: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1a1a1a', // Dark Gray Toast
        zIndex: 100,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        borderLeftWidth: 4, // Accent Border
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    bannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingTop: 8, // Adjust for SafeArea
        gap: 12,
    },
    bannerIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerTextContainer: {
        flex: 1,
    },
    bannerTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    bannerMessage: {
        color: '#ccc',
        fontSize: 12,
        lineHeight: 16,
    },
    overrideButton: {
        marginTop: 16,
        alignItems: 'center',
        padding: 8,
    },
    overrideText: {
        color: '#666',
        fontSize: 12,
        textDecorationLine: 'underline',
    },
});
