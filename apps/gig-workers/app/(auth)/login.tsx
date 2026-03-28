import React, { useState } from "react";
import { Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { useRouter } from "expo-router";
import { Ionicons as IoniconsVector } from "@expo/vector-icons";
import { withUniwind } from "uniwind";
import { Alert } from "heroui-native/alert";
import { Button } from "heroui-native/button";
import { Description } from "heroui-native/description";
import { FieldError } from "heroui-native/field-error";
import { Input } from "heroui-native/input";
import { InputOTP, REGEXP_ONLY_DIGITS } from "heroui-native/input-otp";
import { Label } from "heroui-native/label";
import { Spinner } from "heroui-native/spinner";
import { TextField } from "heroui-native/text-field";

import { AuthShell } from "../../components/ui/auth-shell";
import { authClient } from "../../lib/auth-client";
import { workerTheme } from "../../lib/theme";
import { checkWorkerEligibility, persistWorkerSession } from "../../lib/worker-auth";
import { otpSchema, phoneSchema, validate } from "../../lib/validation";

const Ionicons = withUniwind(IoniconsVector as any);

export default function LoginScreen() {
    const router = useRouter();
    const [phoneNumber, setPhoneNumber] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<"phone" | "otp">("phone");
    const [loading, setLoading] = useState(false);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [otpError, setOtpError] = useState<string | null>(null);
    const [generalError, setGeneralError] = useState<string | null>(null);

    const clearErrors = () => {
        setPhoneError(null);
        setOtpError(null);
        setGeneralError(null);
    };

    const handleSendOtp = async () => {
        clearErrors();

        const result = phoneSchema.safeParse(phoneNumber);
        if (!result.success) {
            const message = result.error.issues[0]?.message ?? "Enter a valid phone number.";
            setPhoneError(message);
            Toast.show({
                type: "error",
                text1: "Invalid Phone Number",
                text2: message,
            });
            return;
        }

        const formattedPhone = result.data;
        setLoading(true);

        try {
            const access = await checkWorkerEligibility(formattedPhone);
            if (!access.eligible) {
                const message = "Your number has not been added to any organization yet.";
                setGeneralError(message);
                Toast.show({
                    type: "error",
                    text1: "Not invited yet",
                    text2: message,
                });
                return;
            }

            const res = await (authClient as any).phoneNumber.sendOtp({
                phoneNumber: formattedPhone,
            });

            if (res?.error) {
                console.error("[Login] Send OTP Error:", res.error);
                const message = res.error.message || "Failed to send code.";
                setGeneralError(message);
                Toast.show({
                    type: "error",
                    text1: "Failed to send code",
                    text2: message,
                });
                return;
            }

            setStep("otp");
            Toast.show({
                type: "success",
                text1: "Code sent",
                text2: "Check your messages for the 6-digit code.",
            });
        } catch (err: any) {
            console.error("[Login] Send Exception:", err);
            const message = err.message || "Failed to send code.";
            setGeneralError(message);
            Toast.show({
                type: "error",
                text1: "Error",
                text2: message,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        clearErrors();

        const phoneResult = phoneSchema.safeParse(phoneNumber);
        const otpValidationError = validate(otpSchema, otp);

        if (!phoneResult.success || otpValidationError) {
            if (!phoneResult.success) {
                setPhoneError(phoneResult.error.issues[0]?.message ?? "Enter a valid phone number.");
            }
            if (otpValidationError) {
                setOtpError(otpValidationError);
            }

            Toast.show({
                type: "error",
                text1: "Validation Error",
                text2: !phoneResult.success
                    ? phoneResult.error.issues[0]?.message ?? "Enter a valid phone number."
                    : (otpValidationError || "Enter a valid verification code."),
            });
            return;
        }

        const formattedPhone = phoneResult.data;
        setLoading(true);

        try {
            const res = await (authClient as any).phoneNumber.verify({
                phoneNumber: formattedPhone,
                code: otp,
            });

            if (res?.error) {
                console.error("[Login] Verify Error:", res.error);
                const message = res.error.message || "Verification failed.";
                setGeneralError(message);
                Toast.show({
                    type: "error",
                    text1: "Verification Failed",
                    text2: message,
                });
                return;
            }

            await persistWorkerSession(res);
            router.replace("/(tabs)");
        } catch (err: any) {
            console.error("[Login] Verify Exception:", err);
            const message = err.message || "Verification failed.";
            setGeneralError(message);
            Toast.show({
                type: "error",
                text1: "Error",
                text2: message,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell
            eyebrow="Workers Hive"
            title={step === "phone" ? "Welcome back" : "Enter your code"}
            description={
                step === "phone"
                    ? "Sign in with the mobile number your manager added to the workforce."
                    : "Use the 6-digit code we sent to your phone to finish signing in."
            }
            icon={
                <Ionicons
                    name={step === "phone" ? "phone-portrait-outline" : "key-outline"}
                    size={30}
                    className="text-secondary"
                />
            }
            footer={
                <Text className="text-center text-sm leading-5 text-muted">
                    Workers can only sign in after being invited by a business admin or manager.
                </Text>
            }
        >
            {step === "phone" ? (
                <>
                    <Alert status="accent">
                        <Alert.Indicator />
                        <Alert.Content>
                            <Alert.Title>Roster access only</Alert.Title>
                            <Alert.Description>
                                Use the same number your manager added when inviting you.
                            </Alert.Description>
                        </Alert.Content>
                    </Alert>

                    <TextField isRequired isInvalid={Boolean(phoneError)}>
                        <Label>Mobile number</Label>
                        <Input
                            placeholder="+1 555 000 0000"
                            keyboardType="phone-pad"
                            textContentType="telephoneNumber"
                            autoComplete="tel"
                            value={phoneNumber}
                            onChangeText={(value) => {
                                setPhoneNumber(value);
                                setPhoneError(null);
                                setGeneralError(null);
                            }}
                            testID="input-phone"
                        />
                        <Description>We’ll text a 6-digit sign-in code to this number.</Description>
                        {phoneError ? <FieldError>{phoneError}</FieldError> : null}
                    </TextField>

                    {generalError ? (
                        <Alert status="danger">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Title>Unable to continue</Alert.Title>
                                <Alert.Description>{generalError}</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    ) : null}

                    <Button
                        onPress={handleSendOtp}
                        isDisabled={loading}
                        testID="button-send-code"
                    >
                        {loading ? <Spinner size="sm" color={workerTheme.colors.white} /> : null}
                        <Button.Label>{loading ? "Sending code" : "Send code"}</Button.Label>
                    </Button>
                </>
            ) : (
                <>
                    <Alert>
                        <Alert.Indicator />
                        <Alert.Content>
                            <Alert.Title>Code sent</Alert.Title>
                            <Alert.Description>
                                Enter the code we sent to {phoneNumber}.
                            </Alert.Description>
                        </Alert.Content>
                    </Alert>

                    <TextField isInvalid={Boolean(otpError)}>
                        <Label>Verification code</Label>
                        <View className="pt-1">
                            <InputOTP
                                value={otp}
                                onChange={(value) => {
                                    setOtp(value);
                                    setOtpError(null);
                                    setGeneralError(null);
                                }}
                                maxLength={6}
                                inputMode="numeric"
                                pattern={REGEXP_ONLY_DIGITS}
                                textInputProps={{
                                    keyboardType: "number-pad",
                                    textContentType: "oneTimeCode",
                                    autoComplete: "sms-otp",
                                    testID: "input-otp",
                                }}
                            >
                                <InputOTP.Group className="flex-row items-center justify-between gap-2">
                                    {[0, 1, 2].map((index) => (
                                        <InputOTP.Slot key={index} index={index} className="flex-1" />
                                    ))}
                                    <InputOTP.Separator className="w-2" />
                                    {[3, 4, 5].map((index) => (
                                        <InputOTP.Slot key={index} index={index} className="flex-1" />
                                    ))}
                                </InputOTP.Group>
                            </InputOTP>
                        </View>
                        <Description>Enter the 6-digit code from your text message.</Description>
                        {otpError ? <FieldError>{otpError}</FieldError> : null}
                    </TextField>

                    {generalError ? (
                        <Alert status="danger">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Title>Verification failed</Alert.Title>
                                <Alert.Description>{generalError}</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    ) : null}

                    <View className="gap-3">
                        <Button
                            onPress={handleVerify}
                            isDisabled={loading}
                            testID="button-verify"
                        >
                            {loading ? <Spinner size="sm" color={workerTheme.colors.white} /> : null}
                            <Button.Label>{loading ? "Verifying" : "Verify and sign in"}</Button.Label>
                        </Button>

                        <Button
                            variant="secondary"
                            onPress={() => {
                                setStep("phone");
                                setOtp("");
                                setOtpError(null);
                                setGeneralError(null);
                            }}
                            isDisabled={loading}
                        >
                            <Button.Label>Use a different number</Button.Label>
                        </Button>
                    </View>
                </>
            )}
        </AuthShell>
    );
}
