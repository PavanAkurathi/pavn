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
    Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { authClient } from "../../lib/auth-client";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
    const router = useRouter();
    const [phoneNumber, setPhoneNumber] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [loading, setLoading] = useState(false);

    const handleSendOtp = async () => {
        if (!phoneNumber) {
            Alert.alert("Error", "Please enter your phone number");
            return;
        }
        setLoading(true);
        try {
            // Send OTP
            const res = await (authClient as any).phoneNumber.sendOtp({
                phoneNumber,
            });

            if (res?.error) {
                Alert.alert("Error", res.error.message);
                return;
            }

            setStep('otp');
            Alert.alert("Code Sent", "Please check your messages.");

        } catch (err: any) {
            console.error(err);
            Alert.alert("Error", err.message || "Failed to send code");
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (!otp) {
            Alert.alert("Error", "Please enter the verification code");
            return;
        }
        setLoading(true);
        try {
            // Verify OTP & Login
            // Using verify to establish session
            const res = await (authClient as any).phoneNumber.verify({
                phoneNumber,
                code: otp
            });

            if (res?.error) {
                Alert.alert("Error", res.error.message);
                return;
            }

            // Success
            router.replace("/(tabs)");

        } catch (err: any) {
            console.error(err);
            Alert.alert("Error", err.message || "Verification failed");
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
                        />

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleSendOtp}
                            disabled={loading}
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
                        />

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleVerify}
                            disabled={loading}
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
