import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { authClient } from "../../lib/auth-client";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { checkWorkerEligibility, persistWorkerSession } from "../../lib/worker-auth";
import { workerTheme } from "../../lib/theme";
import { phoneSchema } from "../../lib/validation";

export default function InviteRedemptionScreen() {
    const { code } = useLocalSearchParams();
    const router = useRouter();

    const [phoneNumber, setPhoneNumber] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (typeof code === "string" && code) {
            void SecureStore.setItemAsync("pending_invitation_token", code);
        }
    }, [code]);

    const handleSendOtp = async () => {
        const parsedPhone = phoneSchema.safeParse(phoneNumber);
        if (!parsedPhone.success) {
            Alert.alert("Invalid Phone Number", parsedPhone.error.issues[0]?.message ?? "Enter a valid mobile number.");
            return;
        }

        setLoading(true);

        try {
            const formattedPhone = parsedPhone.data;
            const access = await checkWorkerEligibility(formattedPhone);
            if (!access.eligible) {
                Alert.alert("Not Invited Yet", "Your number has not been added to any organization yet.");
                return;
            }

            const sendOtpRes = await (authClient as any).phoneNumber.sendOtp({
                phoneNumber: formattedPhone,
            });

            if (sendOtpRes.error) {
                throw new Error(sendOtpRes.error.message);
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

        const parsedPhone = phoneSchema.safeParse(phoneNumber);
        if (!parsedPhone.success) {
            Alert.alert("Invalid Phone Number", parsedPhone.error.issues[0]?.message ?? "Enter a valid mobile number.");
            return;
        }

        setLoading(true);

        try {
            const verifyRes = await (authClient as any).phoneNumber.verify({
                phoneNumber: parsedPhone.data,
                code: otp
            });

            if (verifyRes.error) {
                throw new Error(verifyRes.error.message);
            }

            await persistWorkerSession(verifyRes);

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
                        {step === 'phone' ? "Join your schedule" : "Check your texts"}
                    </Text>
                    <Text style={styles.subtitle}>
                        {step === 'phone'
                            ? "Enter the mobile number your organization added for you."
                            : `We sent a code to ${phoneNumber}. Enter it below.`}
                    </Text>
                    {code && (
                        <View style={styles.codeBadge}>
                            <Text style={styles.codeText}>Invite: {code}</Text>
                        </View>
                    )}
                </View>

                {step === 'phone' ? (
                    <View style={styles.form}>
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

                        <TouchableOpacity onPress={() => setStep('phone')} style={{ alignItems: 'center', marginTop: 16 }}>
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
