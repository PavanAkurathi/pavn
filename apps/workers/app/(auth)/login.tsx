import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import Toast from 'react-native-toast-message';
import { useRouter } from "expo-router";
import { authClient } from "../../lib/auth-client";
import { validate, phoneSchema, otpSchema } from "../../lib/validation";
import { Ionicons as IoniconsVector } from "@expo/vector-icons";
// Cast to any to avoid "cannot be used as a JSX component" error due to React 18/19 type conflict
const Ionicons = IoniconsVector as any;

export default function LoginScreen() {
    const router = useRouter();
    const [phoneNumber, setPhoneNumber] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [loading, setLoading] = useState(false);

    const handleSendOtp = async () => {
        // Validation & Formatting
        const result = phoneSchema.safeParse(phoneNumber);
        if (!result.success) {
            Toast.show({
                type: 'error',
                text1: 'Invalid Phone Number',
                text2: result.error.issues[0].message
            });
            return;
        }

        const formattedPhone = result.data; // e.g., +1781...
        setLoading(true);


        try {
            // Send OTP
            const res = await (authClient as any).phoneNumber.sendOtp({
                phoneNumber: formattedPhone,
            });

            if (res?.error) {
                console.error("[Login] Send OTP Error:", res.error);
                Toast.show({
                    type: 'error',
                    text1: 'Failed to send code',
                    text2: res.error.message
                });
                return;
            }


            setStep('otp');
            Toast.show({
                type: 'success',
                text1: 'Code Sent',
                text2: 'Please check your messages.'
            });

        } catch (err: any) {
            console.error("[Login] Send Exception:", err);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: err.message || "Failed to send code"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        // Validation
        const phoneResult = phoneSchema.safeParse(phoneNumber);
        const otpError = validate(otpSchema, otp);

        if (!phoneResult.success || otpError) {
            Toast.show({
                type: 'error',
                text1: 'Validation Error',
                text2: !phoneResult.success
                    ? phoneResult.error.issues[0].message
                    : (otpError || "Invalid input")
            });
            return;
        }

        const formattedPhone = phoneResult.data;
        setLoading(true);


        try {
            // Verify OTP & Login
            // Using verify to establish session
            const res = await (authClient as any).phoneNumber.verify({
                phoneNumber: formattedPhone,
                code: otp
            });

            if (res?.error) {
                console.error("[Login] Verify Error:", res.error);
                Toast.show({
                    type: 'error',
                    text1: 'Verification Failed',
                    text2: res.error.message
                });
                return;
            }

            // Success

            // Extract the session token and store it so our api.ts helper can fetch it
            if (res.data?.token) {
                const SecureStore = require('expo-secure-store');
                await SecureStore.setItemAsync("better-auth.session_token", res.data.token);

                // Auto-accept any pending invitations from Dub.co Deep Links
                try {
                    const orgToken = await SecureStore.getItemAsync("pending_invitation_token");
                    if (orgToken) {
                        console.log("[Login] Processing pending invitation:", orgToken);
                        const inviteRes = await authClient.organization.acceptInvitation({
                            invitationId: orgToken,
                        });

                        if (!inviteRes.error) {
                            await SecureStore.deleteItemAsync("pending_invitation_token");
                            console.log("[Login] Successfully joined organization!");
                        } else {
                            console.warn("[Login] Failed to join organization:", inviteRes.error);
                        }
                    }
                } catch (inviteErr) {
                    console.warn("[Login] Error checking for pending invitation:", inviteErr);
                }
            }

            router.replace("/(tabs)");

        } catch (err: any) {
            console.error("[Login] Verify Exception:", err);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: err.message || "Verification failed"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="phone-portrait-outline" size={32} color="#000" />
                    </View>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>
                        {step === 'phone'
                            ? "Sign in with your mobile number"
                            : `Enter the code sent to ${phoneNumber}`
                        }
                    </Text>
                </View>

                {step === 'phone' ? (
                    <View style={styles.form}>
                        <TextInput
                            style={styles.input}
                            placeholder="+1 555 000 0000"
                            placeholderTextColor="#666"
                            keyboardType="phone-pad"
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            testID="input-phone"
                        />

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleSendOtp}
                            disabled={loading}
                            testID="button-send-code"
                        >
                            {loading ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.buttonText}>Send Code</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.form}>
                        <TextInput
                            style={[styles.input, styles.otpInput]}
                            placeholder="000000"
                            placeholderTextColor="#666"
                            keyboardType="number-pad"
                            maxLength={6}
                            value={otp}
                            onChangeText={setOtp}
                            testID="input-otp"
                        />

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleVerify}
                            disabled={loading}
                            testID="button-verify"
                        >
                            {loading ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.buttonText}>Verify & Sign In</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.backLink}
                            onPress={() => setStep('phone')}
                        >
                            <Text style={styles.backLinkText}>Change Number</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    content: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
    },
    header: {
        alignItems: "center",
        marginBottom: 48,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#222",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: "bold",
        color: "#fff",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: "#888",
        textAlign: "center",
    },
    form: {
        gap: 24,
    },
    input: {
        fontSize: 24,
        color: "#fff",
        borderBottomWidth: 2,
        borderBottomColor: "#333",
        paddingVertical: 12,
    },
    otpInput: {
        letterSpacing: 8,
        textAlign: "center",
    },
    button: {
        backgroundColor: "#fff",
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: "center",
    },
    buttonText: {
        color: "#000",
        fontSize: 16,
        fontWeight: "600",
    },
    backLink: {
        alignItems: "center",
        marginTop: 16,
    },
    backLinkText: {
        color: "#666",
        fontSize: 14,
    },
});
