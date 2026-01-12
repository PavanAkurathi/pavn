import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useGeofence } from '../hooks/useGeofence';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { authClient } from '../lib/auth-client';

export default function Dashboard() {
    const router = useRouter();
    const { clockIn, clockOut, loading: geofenceLoading } = useGeofence();
    const [shifts, setShifts] = useState<any[]>([]);
    const [currentShift, setCurrentShift] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadShifts();
    }, []);

    async function loadShifts() {
        try {
            const data = await api.shifts.getUpcoming();
            setShifts(data);

            // Logic to find "Active" shift would go here
            // For now, take the first one
            if (data.length > 0) {
                setCurrentShift(data[0]);
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to load shifts");
        } finally {
            setLoading(false);
        }
    }

    async function handleClockIn() {
        if (!currentShift) return;

        // Find assignment ID - assuming structure
        const session = authClient.useSession();
        const workerId = session.data?.user?.id;
        const assignment = currentShift.assignments.find((a: any) => a.workerId === workerId);

        if (!assignment) {
            Alert.alert("Error", "Assignment not found");
            return;
        }

        try {
            await clockIn(assignment.id);
            Alert.alert("Success", "Clocked In!");
            loadShifts(); // Refresh
        } catch (e: any) {
            Alert.alert("Clock In Failed", e.message);
        }
    }

    async function handleClockOut() {
        if (!currentShift) return;

        const session = authClient.useSession();
        const workerId = session.data?.user?.id;
        const assignment = currentShift.assignments.find((a: any) => a.workerId === workerId);

        if (!assignment) return;

        try {
            await clockOut(assignment.id);
            Alert.alert("Success", "Clocked Out!");
            loadShifts(); // Refresh
        } catch (e: any) {
            Alert.alert("Clock Out Failed", e.message);
        }
    }

    async function handleLogout() {
        await authClient.signOut();
        router.replace("/(auth)/login");
    }

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Dashboard</Text>
                <TouchableOpacity onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            {currentShift ? (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Current Shift</Text>
                    <Text style={styles.cardText}>{currentShift.title || "Untitled Shift"}</Text>
                    <Text style={styles.cardText}>
                        {new Date(currentShift.startTime).toLocaleString()} -
                        {new Date(currentShift.endTime).toLocaleString()}
                    </Text>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.clockInButton, geofenceLoading && styles.disabled]}
                            onPress={handleClockIn}
                            disabled={geofenceLoading}
                        >
                            <Text style={styles.buttonText}>Clock In</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.clockOutButton, geofenceLoading && styles.disabled]}
                            onPress={handleClockOut}
                            disabled={geofenceLoading}
                        >
                            <Text style={styles.buttonText}>Clock Out</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <Text>No upcoming shifts found.</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 20,
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    logoutText: {
        color: 'red',
        fontSize: 16,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 10,
    },
    cardText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 5,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
    },
    button: {
        flex: 1,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    clockInButton: {
        backgroundColor: '#10b981',
    },
    clockOutButton: {
        backgroundColor: '#ef4444',
    },
    disabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
