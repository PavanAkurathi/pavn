import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native';
import { api, WorkerPreferences } from '../lib/api';
// Assuming a standard consistent layout component or using View directly if no global layout context
// Will use View + SafeArea for now or verify if there is a Layout component.
// Based on previous files, I haven't seen a global Layout, so standard React Native view.

export default function NotificationPreferencesScreen() {
    const [loading, setLoading] = useState(true);
    const [preferences, setPreferences] = useState<WorkerPreferences | null>(null);

    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            const data = await api.preferences.get();
            setPreferences(data);
        } catch (error) {
            Alert.alert('Error', 'Failed to load preferences');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const togglePreference = async (key: keyof WorkerPreferences) => {
        if (!preferences) return;

        // Optimistic update
        const oldValue = preferences[key];
        const newValue = !oldValue;

        setPreferences({ ...preferences, [key]: newValue });

        try {
            await api.preferences.update({ [key]: newValue });
        } catch (error) {
            // Revert on failure
            setPreferences({ ...preferences, [key]: oldValue });
            Alert.alert('Error', 'Failed to update setting');
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!preferences) return null;

    const renderToggle = (label: string, key: keyof WorkerPreferences, description?: string) => (
        <View style={styles.row}>
            <View style={styles.textContainer}>
                <Text style={styles.label}>{label}</Text>
                {description && <Text style={styles.description}>{description}</Text>}
            </View>
            <Switch
                value={!!preferences[key]}
                onValueChange={() => togglePreference(key)}
            />
        </View>
    );

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.header}>Notifications</Text>

            <View style={styles.section}>
                <Text style={styles.sectionHeader}>Reminders</Text>
                {renderToggle("Night Before Shift", "nightBeforeEnabled", "Get a reminder the night before your shift.")}
                {renderToggle("1 Hour Before", "sixtyMinEnabled", "Get a heads-up 60 minutes before start.")}
                {renderToggle("15 Minutes Before", "fifteenMinEnabled", "Get a final warning to head out.")}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionHeader}>Alerts</Text>
                {renderToggle("Shift Starting", "shiftStartEnabled", "Notify when your shift technically begins.")}
                {renderToggle("Late Warning", "lateWarningEnabled", "Alert if you haven't clocked in on time.")}
                {renderToggle("Geofence Arrival", "geofenceAlertsEnabled", "Nudge to clock in when you arrive on site.")}
            </View>

            <View style={styles.section}>
                {/* Placeholder for Quiet Hours UI - WH-203 implemented backend logic, but UI can be simple toggle for now */}
                <Text style={styles.sectionHeader}>Quiet Hours</Text>
                {renderToggle("Enable Quiet Hours", "quietHoursEnabled", "Suppress non-urgent notifications during set times.")}
                {/* DatePicker logic omitted for MVP brevity, can be added later */}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 24,
        marginTop: 40,
    },
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#eee',
    },
    textContainer: {
        flex: 1,
        paddingRight: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4,
    },
    description: {
        fontSize: 14,
        color: '#888',
    },
});
