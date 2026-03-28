import React, { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { Alert as HeroAlert } from "heroui-native/alert";
import { Button } from "heroui-native/button";
import { Description } from "heroui-native/description";
import { FieldError } from "heroui-native/field-error";
import { Input } from "heroui-native/input";
import { InputOTP, REGEXP_ONLY_DIGITS } from "heroui-native/input-otp";
import { Label } from "heroui-native/label";
import { Spinner } from "heroui-native/spinner";
import { TextField } from "heroui-native/text-field";

import { AuthShell } from "../../components/ui/auth-shell";
import { Icon } from "../../components/ui/icon";
import { authClient } from "../../lib/auth-client";
import { otpSchema, phoneSchema, validate } from "../../lib/validation";
import { checkWorkerEligibility, persistWorkerSession } from "../../lib/worker-auth";

export default function InviteRedemptionScreen() {
    const { code } = useLocalSearchParams();
    const router = useRouter();

    const [phoneNumber, setPhoneNumber] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<"phone" | "otp">("phone");
    const [loading, setLoading] = useState(false);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [otpError, setOtpError] = useState<string | null>(null);
    const [generalError, setGeneralError] = useState<string | null>(null);

    useEffect(() => {
        if (typeof code === "string" && code) {
            void SecureStore.setItemAsync("pending_invitation_token", code);
        }
    }, [code]);

    const clearErrors = () => {
        setPhoneError(null);
        setOtpError(null);
        setGeneralError(null);
    };

    const handleSendOtp = async () => {
        clearErrors();
        const parsedPhone = phoneSchema.safeParse(phoneNumber);
        if (!parsedPhone.success) {
            setPhoneError(parsedPhone.error.issues[0]?.message ?? "Enter a valid mobile number.");
            return;
        }

        setLoading(true);
        try {
            const formattedPhone = parsedPhone.data;
            const access = await checkWorkerEligibility(formattedPhone);
            if (!access.eligible) {
                setGeneralError("Your number has not been added to any organization yet.");
                return;
            }

            const sendOtpRes = await (authClient as any).phoneNumber.sendOtp({
                phoneNumber: formattedPhone,
            });

            if (sendOtpRes.error) {
                throw new Error(sendOtpRes.error.message);
            }

            setStep("otp");
        } catch (error: any) {
            setGeneralError(error.message || "Failed to send code.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        clearErrors();
        const parsedPhone = phoneSchema.safeParse(phoneNumber);
        const otpValidationError = validate(otpSchema, otp);

        if (!parsedPhone.success || otpValidationError) {
            if (!parsedPhone.success) {
                setPhoneError(parsedPhone.error.issues[0]?.message ?? "Enter a valid mobile number.");
            }
            if (otpValidationError) {
                setOtpError(otpValidationError);
            }
            return;
        }

        setLoading(true);
        try {
            const verifyRes = await (authClient as any).phoneNumber.verify({
                phoneNumber: parsedPhone.data,
                code: otp,
            });

            if (verifyRes.error) {
                throw new Error(verifyRes.error.message);
            }

            await persistWorkerSession(verifyRes);
            Alert.alert("Welcome!", "You are now verified and part of the team.", [
                { text: "Let’s work", onPress: () => router.replace("/(tabs)") },
            ]);
        } catch (error: any) {
            setGeneralError(error.message || "Verification failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Stack.Screen options={{ title: "Join Team", headerBackTitle: "Back" }} />

            <AuthShell
                eyebrow="Invitation"
                title={step === "phone" ? "Join your schedule" : "Check your texts"}
                description={
                    step === "phone"
                        ? "Enter the mobile number your organization added for you."
                        : `We sent a code to ${phoneNumber}. Enter it below.`
                }
                icon={
                    <Icon
                        name={step === "phone" ? "phone-portrait-outline" : "mail-unread-outline"}
                        size={30}
                        className="text-secondary"
                    />
                }
                footer={
                    code ? (
                        <View className="items-center">
                            <Text className="text-xs font-medium uppercase tracking-[1.2px] text-success">
                                Invite code
                            </Text>
                            <Text className="mt-1 text-sm text-muted">{code}</Text>
                        </View>
                    ) : null
                }
            >
                {step === "phone" ? (
                    <>
                        <TextField isRequired isInvalid={Boolean(phoneError)}>
                            <Label>Mobile number</Label>
                            <Input
                                placeholder="+1 555 000 0000"
                                value={phoneNumber}
                                onChangeText={(value) => {
                                    setPhoneNumber(value);
                                    setPhoneError(null);
                                    setGeneralError(null);
                                }}
                                keyboardType="phone-pad"
                                textContentType="telephoneNumber"
                                autoComplete="tel"
                            />
                            <Description>Use the same number attached to your invitation.</Description>
                            {phoneError ? <FieldError>{phoneError}</FieldError> : null}
                        </TextField>

                        {generalError ? (
                            <HeroAlert status="danger">
                                <HeroAlert.Indicator />
                                <HeroAlert.Content>
                                    <HeroAlert.Title>Unable to continue</HeroAlert.Title>
                                    <HeroAlert.Description>{generalError}</HeroAlert.Description>
                                </HeroAlert.Content>
                            </HeroAlert>
                        ) : null}

                        <Button onPress={handleSendOtp} isDisabled={loading}>
                            {loading ? <Spinner size="sm" /> : null}
                            <Button.Label>{loading ? "Sending code" : "Send code"}</Button.Label>
                        </Button>
                    </>
                ) : (
                    <>
                        <HeroAlert status="success">
                            <HeroAlert.Indicator />
                            <HeroAlert.Content>
                                <HeroAlert.Title>Code sent</HeroAlert.Title>
                                <HeroAlert.Description>Enter the 6-digit code from your text message.</HeroAlert.Description>
                            </HeroAlert.Content>
                        </HeroAlert>

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
                            {otpError ? <FieldError>{otpError}</FieldError> : null}
                        </TextField>

                        {generalError ? (
                            <HeroAlert status="danger">
                                <HeroAlert.Indicator />
                                <HeroAlert.Content>
                                    <HeroAlert.Title>Verification failed</HeroAlert.Title>
                                    <HeroAlert.Description>{generalError}</HeroAlert.Description>
                                </HeroAlert.Content>
                            </HeroAlert>
                        ) : null}

                        <View className="gap-3">
                            <Button onPress={handleVerifyOtp} isDisabled={loading}>
                                {loading ? <Spinner size="sm" /> : null}
                                <Button.Label>{loading ? "Verifying" : "Verify and join"}</Button.Label>
                            </Button>

                            <Button variant="secondary" onPress={() => setStep("phone")} isDisabled={loading}>
                                <Button.Label>Use a different number</Button.Label>
                            </Button>
                        </View>
                    </>
                )}
            </AuthShell>
        </>
    );
}
