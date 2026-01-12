import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function PersonalInfoScreen() {
    const router = useRouter();

    // Mock initial state
    const [form, setForm] = useState({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "(555) 123-4567",
        emergencyName: "Jane Doe",
        emergencyRelation: "Spouse",
        emergencyPhone: "(555) 987-6543",
    });

    const handleChange = (key: string, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>Personal Information</Text>
                <TouchableOpacity style={styles.saveButton}>
                    <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView style={styles.content}>

                    {/* Identity Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>IDENTITY</Text>
                        <View style={styles.inputGroup}>
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>First Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.firstName}
                                    onChangeText={(t) => handleChange("firstName", t)}
                                    placeholderTextColor="#666"
                                />
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Last Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.lastName}
                                    onChangeText={(t) => handleChange("lastName", t)}
                                    placeholderTextColor="#666"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Contact Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>CONTACT</Text>
                        <View style={styles.inputGroup}>
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Email</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.email}
                                    onChangeText={(t) => handleChange("email", t)}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    placeholderTextColor="#666"
                                />
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Phone</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.phone}
                                    onChangeText={(t) => handleChange("phone", t)}
                                    keyboardType="phone-pad"
                                    placeholderTextColor="#666"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Emergency Contact */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>EMERGENCY CONTACT</Text>
                        <View style={styles.inputGroup}>
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Full Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.emergencyName}
                                    onChangeText={(t) => handleChange("emergencyName", t)}
                                    placeholder="e.g. Jane Doe"
                                    placeholderTextColor="#666"
                                />
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Relationship</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.emergencyRelation}
                                    onChangeText={(t) => handleChange("emergencyRelation", t)}
                                    placeholder="e.g. Spouse, Parent"
                                    placeholderTextColor="#666"
                                />
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Phone Number</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.emergencyPhone}
                                    onChangeText={(t) => handleChange("emergencyPhone", t)}
                                    keyboardType="phone-pad"
                                    placeholderTextColor="#666"
                                />
                            </View>
                        </View>
                        <Text style={styles.helperText}>
                            Having an emergency contact is mandatory for all active crew members.
                        </Text>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
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
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#222",
    },
    backButton: {
        padding: 4,
        marginLeft: -4,
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#fff",
    },
    saveButton: {
        padding: 4,
        marginRight: -4,
    },
    saveText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    content: {
        flex: 1,
    },
    section: {
        marginTop: 24,
        marginBottom: 8,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: "600",
        color: "#666",
        paddingHorizontal: 16,
        marginBottom: 8,
        letterSpacing: 1,
    },
    inputGroup: {
        backgroundColor: "#111",
        paddingHorizontal: 16,
    },
    inputContainer: {
        paddingVertical: 12,
    },
    label: {
        fontSize: 13,
        color: "#888",
        marginBottom: 4,
    },
    input: {
        fontSize: 16,
        color: "#fff",
        paddingVertical: 4,
    },
    divider: {
        height: 1,
        backgroundColor: "#222",
    },
    helperText: {
        marginTop: 8,
        marginHorizontal: 16,
        fontSize: 12,
        color: "#666",
        fontStyle: "italic",
    },
});
