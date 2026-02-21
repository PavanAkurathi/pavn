import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { authClient } from "../lib/auth-client";
import { api } from "../lib/api";

export default function PersonalInfoScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", phone: "" });
    const [original, setOriginal] = useState({ name: "", email: "", phone: "" });

    useEffect(() => { loadProfile(); }, []);

    const loadProfile = async () => {
        try {
            const session = await authClient.getSession();
            const u = session.data?.user;
            if (u) {
                const data = {
                    name: u.name || "",
                    email: u.email || "",
                    phone: (u as any).phoneNumber || "",
                };
                setForm(data);
                setOriginal(data);
            }
        } catch (e) {
            console.error("Failed to load profile:", e);
        } finally {
            setLoading(false);
        }
    };

    const hasChanges = form.name !== original.name;

    const handleSave = async () => {
        if (!hasChanges) return;
        setSaving(true);
        try {
            await api.worker.updateProfile({ name: form.name });
            setOriginal({ ...original, name: form.name });
            Alert.alert("Saved", "Your profile has been updated.");
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={s.container} edges={["top"]}>
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.container} edges={["top"]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={s.title}>Personal Information</Text>
                <TouchableOpacity onPress={handleSave} disabled={!hasChanges || saving}>
                    {saving ? <ActivityIndicator size="small" color="#3B82F6" /> : (
                        <Text style={[s.saveText, !hasChanges && { color: "#444" }]}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                    <View style={s.section}>
                        <Text style={s.sectionLabel}>IDENTITY</Text>
                        <View style={s.inputGroup}>
                            <Field label="Full Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
                        </View>
                    </View>

                    <View style={s.section}>
                        <Text style={s.sectionLabel}>CONTACT</Text>
                        <View style={s.inputGroup}>
                            <Field label="Email" value={form.email} editable={false} />
                            <View style={s.divider} />
                            <Field label="Phone" value={form.phone} editable={false} />
                        </View>
                        <Text style={s.helperText}>
                            Email and phone are managed by your organization admin.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function Field({ label, value, onChange, editable = true }: {
    label: string; value: string; onChange?: (v: string) => void; editable?: boolean;
}) {
    return (
        <View style={s.fieldContainer}>
            <Text style={s.fieldLabel}>{label}</Text>
            <TextInput
                style={[s.fieldInput, !editable && { color: "#555" }]}
                value={value}
                onChangeText={onChange}
                editable={editable}
                placeholderTextColor="#444"
            />
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0A0A0A" },
    header: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: "#1A1A1A",
    },
    title: { fontSize: 18, fontWeight: "700", color: "#fff" },
    saveText: { fontSize: 16, fontWeight: "600", color: "#3B82F6" },
    section: { marginTop: 24 },
    sectionLabel: {
        fontSize: 12, fontWeight: "600", color: "#666",
        paddingHorizontal: 16, marginBottom: 8, letterSpacing: 1,
    },
    inputGroup: { backgroundColor: "#141414", paddingHorizontal: 16 },
    fieldContainer: { paddingVertical: 12 },
    fieldLabel: { fontSize: 12, color: "#888", marginBottom: 4 },
    fieldInput: { fontSize: 16, color: "#fff", paddingVertical: 4 },
    divider: { height: 1, backgroundColor: "#222" },
    helperText: { marginTop: 8, marginHorizontal: 16, fontSize: 12, color: "#555" },
});
