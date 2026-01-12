import { View, Text, StyleSheet, TouchableOpacity, Image, SectionList, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { api } from "../../lib/api";

export default function ScheduleScreen() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<'upcoming' | 'history'>('upcoming');
    const [upcomingShifts, setUpcomingShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // MOCK USER
    const user = {
        name: "John",
        rating: "4.9",
        avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
    };

    useEffect(() => {
        loadShifts();
    }, []);

    const loadShifts = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const shifts = await api.shifts.getUpcoming();
            const grouped = groupShiftsByDate(shifts);
            setUpcomingShifts(grouped);
        } catch (err) {
            console.error(err);
            // Optional: Alert.alert("Error", "Failed to load shifts");
        } finally {
            setLoading(false);
        }
    };

    const groupShiftsByDate = (shifts: any[]) => {
        if (!shifts || shifts.length === 0) return [];

        // Simple grouping
        const groups: { [key: string]: any[] } = {};

        shifts.forEach(shift => {
            const date = new Date(shift.startTime);
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            let title = date.toLocaleDateString();
            if (date.toDateString() === today.toDateString()) title = "Today";
            else if (date.toDateString() === tomorrow.toDateString()) title = "Tomorrow";
            else title = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            if (!groups[title]) groups[title] = [];

            groups[title].push({
                id: shift.id,
                time: new Date(shift.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
                role: "Worker", // Placeholder until we get role from assignment
                venue: shift.location?.name || "Unknown Venue",
                org: shift.organization?.name || "Organization",
                isNext: false // Logic to be improved
            });
        });

        // Convert to array
        const result = Object.keys(groups).map(title => ({
            title,
            data: groups[title]
        }));

        // Sort? (Assuming API returns sorted for now)
        return result;
    };

    const renderUpcomingItem = ({ item }: { item: any }) => {
        const isNext = item.isNext;

        return (
            <TouchableOpacity
                style={[styles.rowContainer, isNext && styles.rowNext]}
                onPress={() => router.push(`/shift/${item.id}`)}
                activeOpacity={0.7}
            >
                {/* Time Column */}
                <View style={styles.timeColumn}>
                    <Text style={[styles.timeText, isNext && styles.timeTextNext]}>
                        {item.time}
                    </Text>
                    {isNext && (
                        <Text style={styles.nextLabel}>NEXT</Text>
                    )}
                </View>

                {/* Details Column */}
                <View style={styles.detailsColumn}>
                    <Text style={[styles.roleText, isNext && styles.roleTextNext]}>
                        {item.role}
                    </Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.venueText}>{item.venue}</Text>
                        <Text style={styles.dotSeparator}>•</Text>
                        <Text style={styles.orgText}>{item.org}</Text>
                    </View>
                </View>

                {/* Arrow (Optional, helps touch affordance) */}
                <Ionicons name="chevron-forward" size={16} color={isNext ? "#fff" : "#333"} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            {/* Header: Identity & Status (Worker Centric) */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => router.push("/(tabs)/profile")}>
                        <Image source={{ uri: user.avatar }} style={styles.avatar} />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.greeting}>Hi, {user.name}</Text>
                        <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={12} color="#FFD700" />
                            <Text style={styles.ratingText}>{user.rating}</Text>
                        </View>
                    </View>
                </View>
                <TouchableOpacity style={styles.iconButton} onPress={loadShifts}>
                    <Ionicons name="refresh-outline" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Toggle: Upcoming vs History */}
            <View style={styles.toggleContainer}>
                <TouchableOpacity
                    style={[styles.toggleButton, viewMode === 'upcoming' && styles.toggleActive]}
                    onPress={() => setViewMode('upcoming')}
                >
                    <Text style={[styles.toggleText, viewMode === 'upcoming' && styles.toggleTextActive]}>Upcoming</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleButton, viewMode === 'history' && styles.toggleActive]}
                    onPress={() => setViewMode('history')}
                >
                    <Text style={[styles.toggleText, viewMode === 'history' && styles.toggleTextActive]}>History</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                {loading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#fff" />
                    </View>
                ) : (
                    viewMode === 'upcoming' ? (
                        <SectionList
                            sections={upcomingShifts}
                            keyExtractor={(item) => item.id}
                            renderItem={renderUpcomingItem}
                            renderSectionHeader={({ section: { title } }) => (
                                <Text style={styles.sectionHeader}>{title}</Text>
                            )}
                            contentContainerStyle={{ paddingBottom: 24 }}
                            stickySectionHeadersEnabled={false}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: '#666' }}>No upcoming shifts found.</Text>
                                    <TouchableOpacity onPress={loadShifts} style={{ marginTop: 10 }}>
                                        <Text style={{ color: '#4CAF50' }}>Tap to refresh</Text>
                                    </TouchableOpacity>
                                </View>
                            }
                        />
                    ) : (
                        /* HISTORY FEED - Keep Mock for now */
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Text style={{ color: '#666' }}>History not connected yet.</Text>
                        </View>
                    )
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 10,
        marginBottom: 20,
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#333",
    },
    greeting: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    ratingText: {
        color: "#ccc",
        fontSize: 12,
        fontWeight: "600",
    },
    iconButton: {
        width: 40,
        height: 40,
        backgroundColor: "#111",
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#222",
    },
    notificationDot: {
        position: "absolute",
        top: 8,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#FF5252",
        borderWidth: 1,
        borderColor: "#111",
    },
    // Toggle
    toggleContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 16,
        backgroundColor: '#111',
        borderRadius: 12,
        padding: 4,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    toggleActive: {
        backgroundColor: '#333',
    },
    toggleText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '600',
    },
    toggleTextActive: {
        color: '#fff',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    sectionHeader: {
        color: "#666",
        fontSize: 12,
        fontWeight: "700",
        marginTop: 16,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 1,
    },

    // UNIFIED ROW STYLES
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    rowNext: {
        // Subtle highlight for next item? Or just rely on text?
        // User said: "only is text are little big bold nothing less!"
        // So no background changes.
        borderBottomColor: '#333', // Slightly more visible separator
        paddingVertical: 16,       // Slightly more breathing room
    },
    timeColumn: {
        width: 85,
    },
    timeText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    timeTextNext: {
        fontSize: 18,     // "Little big"
        fontWeight: '800',// "Bold"
        color: '#4CAF50', // Keeps the "Upcoming" theme but subtle
    },
    nextLabel: {
        color: '#4CAF50',
        fontSize: 10,
        fontWeight: '800',
        marginTop: 2,
    },
    detailsColumn: {
        flex: 1,
    },
    roleText: {
        color: '#eee',
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 2,
    },
    roleTextNext: {
        fontSize: 18,     // Match the time scale bump
        fontWeight: '700',
        color: '#fff',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    venueText: {
        color: '#888',
        fontSize: 14,
    },
    dotSeparator: {
        color: '#444',
        marginHorizontal: 6,
    },
    orgText: {
        color: '#666',
        fontSize: 14,
    },

    // History (Keep as is for now)
    historyCard: {
        backgroundColor: "#111",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#222",
    },
    historyHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    historyRole: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    historyEarnings: {
        color: "#4CAF50",
        fontSize: 16,
        fontWeight: "700",
    },
    cardOrg: { // Only used in history now
        color: "#888",
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        marginBottom: 4,
    },
    historyVenue: {
        color: "#ccc",
        fontSize: 14,
        marginBottom: 4,
    },
    historyTime: {
        color: "#666",
        fontSize: 12,
    },
});
