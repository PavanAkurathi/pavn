import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { authClient } from "../../lib/auth-client";
import { Ionicons } from "@expo/vector-icons";
import { workerTheme } from "../../lib/theme";

export default function InviteRedemptionScreen() {
    const { code } = useLocalSearchParams();
    const router = useRouter();

    const [name, setName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [password, setPassword] = useState(""); // Still needed for password fallback or we can auto-generate/skip
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<'details' | 'otp'>('details');
    const [loading, setLoading] = useState(false);

    const handleSendOtp = async () => {
        if (!name || !phoneNumber || !password) {
            Alert.alert("Missing Fields", "Please fill in all details.");
            return;
        }

        setLoading(true);

        try {
            // 1. Sign Up User (Creates account, sends OTP to phone)
            // Casting to 'any' because phoneNumber plugin types might not be inferred correctly in this env
            const signUpRes = await (authClient.signUp as any).phoneNumber({
                phoneNumber,
                password,
                name,
            });

            if (signUpRes.error) {
                throw new Error(signUpRes.error.message);
            }

            setStep('otp');

        } catch (err: any) {
            Alert.alert("Sign Up Failed", err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp) return;
        setLoading(true);

        try {
            // 2. Verify Phone OTP (This logs them in)
            // Using authClient.phoneNumber.verify as confirmed by docs/types
            const verifyRes = await (authClient as any).phoneNumber.verify({
                phoneNumber,
                code: otp
            });

            if (verifyRes.error) {
                throw new Error(verifyRes.error.message);
            }

            // 3. Accept Invitation (Now that we are logged in)
            const inviteRes = await authClient.organization.acceptInvitation({
                invitationId: code as string,
            });

            if (inviteRes.error) {
                throw new Error("Joined, but invite failed: " + inviteRes.error.message);
            }

            Alert.alert("Welcome!", "You are now verified and part of the team.", [
                { text: "Let's Work", onPress: () => router.replace("/(tabs)") }
            ]);

        } catch (err: any) {
            Alert.alert("Verification Failed", err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <Stack.Screen options={{ title: "Join Team", headerBackTitle: "Back" }} />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="phone-portrait-outline" size={32} color={workerTheme.colors.secondary} />
                    </View>
                    <Text style={styles.title}>
                        {step === 'details' ? "Let's get you set up" : "Check your texts"}
                    </Text>
                    <Text style={styles.subtitle}>
                        {step === 'details'
                            ? "Enter your mobile number to create your worker account."
                            : `We sent a code to ${phoneNumber}. Enter it below.`}
                    </Text>
                    {code && (
                        <View style={styles.codeBadge}>
                            <Text style={styles.codeText}>Invite: {code}</Text>
                        </View>
                    )}
                </View>

                {step === 'details' ? (
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Your Name"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Mobile Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="+1 555 000 0000"
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Create Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleSendOtp}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={workerTheme.colors.white} />
                            ) : (
                                <Text style={styles.buttonText}>Send Code</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Verification Code</Text>
                            <TextInput
                                style={[styles.input, { textAlign: 'center', letterSpacing: 8, fontSize: 24 }]}
                                placeholder="000000"
                                value={otp}
                                onChangeText={setOtp}
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleVerifyOtp}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={workerTheme.colors.white} />
                            ) : (
                                <Text style={styles.buttonText}>Verify & Join</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setStep('details')} style={{ alignItems: 'center', marginTop: 16 }}>
                            <Text style={{ color: workerTheme.colors.secondary }}>Change Number</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: workerTheme.colors.background,
    },
    content: {
        padding: 24,
        paddingTop: 40,
    },
    header: {
        alignItems: "center",
        marginBottom: 40,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: workerTheme.colors.secondarySoft,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: workerTheme.colors.foreground,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: workerTheme.colors.mutedForeground,
        textAlign: "center",
        marginHorizontal: 32,
    },
    codeBadge: {
        marginTop: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: workerTheme.colors.successSoft,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#C8E6C9",
    },
    codeText: {
        color: workerTheme.colors.success,
        fontSize: 12,
        fontWeight: "600",
    },
    form: {
        gap: 24,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: workerTheme.colors.foreground,
    },
    input: {
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        backgroundColor: workerTheme.colors.surfaceInset,
        color: workerTheme.colors.foreground,
    },
    button: {
        backgroundColor: workerTheme.colors.primary,
        height: 56,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    buttonText: {
        color: workerTheme.colors.white,
        fontSize: 16,
        fontWeight: "600",
    },
});
