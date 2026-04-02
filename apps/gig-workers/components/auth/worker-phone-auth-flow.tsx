import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { useRouter } from "expo-router";

import { Alert } from "heroui-native/alert";
import { Button } from "heroui-native/button";
import { Description } from "heroui-native/description";
import { FieldError } from "heroui-native/field-error";
import { Input } from "heroui-native/input";
import { InputOTP, REGEXP_ONLY_DIGITS } from "heroui-native/input-otp";
import { Label } from "heroui-native/label";
import { Spinner } from "heroui-native/spinner";
import { TextField } from "heroui-native/text-field";

import { AuthShell } from "../ui/auth-shell";
import { Icon } from "../ui/icon";
import { authClient } from "../../lib/auth-client";
import { workerTheme } from "../../lib/theme";
import {
    type WorkerEligibilityResponse,
    checkWorkerEligibility,
    persistWorkerSession,
} from "../../lib/worker-auth";
import { otpSchema, phoneSchema, validate } from "../../lib/validation";

type WorkerPhoneAuthFlowProps = {
    mode: "login" | "invite";
    inviteCode?: string | null;
};

type StepState = "phone" | "otp";

function pluralizeBusiness(count: number): string {
    return count === 1 ? "1 business" : `${count} businesses`;
}

function AuthProgress({ currentStep }: { currentStep: StepState }) {
    const steps = [
        { key: "phone", label: "Confirm number" },
        { key: "otp", label: "Enter code" },
    ] as const;

    return (
        <View className="flex-row items-center justify-between rounded-[24px] bg-default px-4 py-3">
            {steps.map((step, index) => {
                const isActive = currentStep === step.key;
                const isComplete = currentStep === "otp" && step.key === "phone";

                return (
                    <View
                        key={step.key}
                        className={`flex-1 ${index === 0 ? "pr-2" : "pl-2"}`}
                    >
                        <View className="flex-row items-center gap-3">
                            <View
                                className={`h-8 w-8 items-center justify-center rounded-full ${
                                    isActive || isComplete ? "bg-secondary" : "bg-default-200"
                                }`}
                            >
                                <Text
                                    className={`text-sm font-semibold ${
                                        isActive || isComplete ? "text-white" : "text-muted"
                                    }`}
                                >
                                    {isComplete ? "✓" : index + 1}
                                </Text>
                            </View>
                            <View className="flex-1">
                                <Text
                                    className={`text-sm font-medium ${
                                        isActive || isComplete ? "text-foreground" : "text-muted"
                                    }`}
                                >
                                    {step.label}
                                </Text>
                            </View>
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

export function WorkerPhoneAuthFlow({
    mode,
    inviteCode,
}: WorkerPhoneAuthFlowProps) {
    const router = useRouter();
    const [phoneNumber, setPhoneNumber] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<StepState>("phone");
    const [loading, setLoading] = useState(false);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [otpError, setOtpError] = useState<string | null>(null);
    const [generalError, setGeneralError] = useState<string | null>(null);
    const [access, setAccess] = useState<WorkerEligibilityResponse | null>(null);

    const copy = useMemo(() => {
        const inviteMode = mode === "invite";

        return {
            eyebrow: inviteMode ? "Worker invite" : "Workers Hive",
            phoneTitle: inviteMode ? "Join your team" : "Sign in to work",
            otpTitle: access?.existingAccount ? "Welcome back" : "Confirm your access",
            phoneDescription: inviteMode
                ? "This link starts the process, but access still depends on the mobile number your business added to the workforce."
                : "Use the same mobile number your manager added when they brought you into the workforce.",
            otpDescription:
                access?.organizationCount && access.organizationCount > 0
                    ? `We found ${pluralizeBusiness(access.organizationCount)} connected to this number. Enter the 6-digit code to continue.`
                    : "Enter the 6-digit code we texted to your phone to finish signing in.",
            phoneAlertTitle: inviteMode ? "Invite link detected" : "Workforce access only",
            phoneAlertDescription: inviteMode
                ? "The link is a shortcut. Your real access still comes from the workforce record tied to your phone number."
                : "Workers can only sign in after a business has added them to the workforce.",
            footer: inviteMode
                ? "If your phone number has changed since the invite was sent, ask your manager to update it before trying again."
                : "If you do not see a code, confirm that your manager added the correct number to your workforce profile.",
        };
    }, [access?.existingAccount, access?.organizationCount, mode]);

    const resetErrors = () => {
        setPhoneError(null);
        setOtpError(null);
        setGeneralError(null);
    };

    const resetToPhoneStep = () => {
        setStep("phone");
        setOtp("");
        setOtpError(null);
        setGeneralError(null);
        setAccess(null);
    };

    const handleSendOtp = async (source: "phone" | "resend" = "phone") => {
        resetErrors();

        const parsedPhone = phoneSchema.safeParse(phoneNumber);
        if (!parsedPhone.success) {
            const message =
                parsedPhone.error.issues[0]?.message ??
                "Enter a valid mobile number.";
            setPhoneError(message);
            Toast.show({
                type: "error",
                text1: "Invalid phone number",
                text2: message,
            });
            return;
        }

        setLoading(true);

        try {
            const formattedPhone = parsedPhone.data;
            const nextAccess = await checkWorkerEligibility(formattedPhone);

            if (!nextAccess.eligible) {
                const message =
                    "This number has not been added to a workforce yet. Ask your manager to add or invite you first.";
                setGeneralError(message);
                setAccess(null);
                Toast.show({
                    type: "error",
                    text1: "Not added yet",
                    text2: message,
                });
                return;
            }

            const response = await (authClient as any).phoneNumber.sendOtp({
                phoneNumber: formattedPhone,
            });

            if (response?.error) {
                throw new Error(response.error.message || "Failed to send code.");
            }

            setPhoneNumber(formattedPhone);
            setAccess(nextAccess);
            setOtp("");
            setStep("otp");

            Toast.show({
                type: "success",
                text1: source === "resend" ? "Code resent" : "Code sent",
                text2:
                    source === "resend"
                        ? "Check your messages for the newest 6-digit code."
                        : "Check your messages for the 6-digit sign-in code.",
            });
        } catch (error: any) {
            const message = error?.message || "Failed to send code.";
            setGeneralError(message);
            Toast.show({
                type: "error",
                text1: "Unable to send code",
                text2: message,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        resetErrors();

        const parsedPhone = phoneSchema.safeParse(phoneNumber);
        const otpValidationError = validate(otpSchema, otp);

        if (!parsedPhone.success || otpValidationError) {
            const phoneMessage =
                parsedPhone.success
                    ? null
                    : parsedPhone.error.issues[0]?.message ??
                      "Enter a valid mobile number.";

            if (phoneMessage) {
                setPhoneError(phoneMessage);
            }

            if (otpValidationError) {
                setOtpError(otpValidationError);
            }

            Toast.show({
                type: "error",
                text1: "Check your details",
                text2:
                    phoneMessage ||
                    otpValidationError ||
                    "Enter a valid verification code.",
            });
            return;
        }

        setLoading(true);

        try {
            const response = await (authClient as any).phoneNumber.verify({
                phoneNumber: parsedPhone.data,
                code: otp,
            });

            if (response?.error) {
                throw new Error(response.error.message || "Verification failed.");
            }

            await persistWorkerSession(response);

            Toast.show({
                type: "success",
                text1: access?.existingAccount ? "Signed in" : "Access confirmed",
                text2: access?.existingAccount
                    ? "Opening your worker workspace."
                    : "Your worker workspace is ready.",
            });

            router.replace("/(tabs)");
        } catch (error: any) {
            const message = error?.message || "Verification failed.";
            setGeneralError(message);
            Toast.show({
                type: "error",
                text1: "Verification failed",
                text2: message,
            });
        } finally {
            setLoading(false);
        }
    };

    const iconName =
        step === "phone"
            ? mode === "invite"
                ? "mail-open-outline"
                : "phone-portrait-outline"
            : "key-outline";

    const accessMessage =
        access && access.organizationCount > 0
            ? access.organizationCount === 1
                ? "We found one business connected to this phone number."
                : `We found ${pluralizeBusiness(access.organizationCount)} connected to this phone number.`
            : null;

    return (
        <AuthShell
            eyebrow={copy.eyebrow}
            title={step === "phone" ? copy.phoneTitle : copy.otpTitle}
            description={step === "phone" ? copy.phoneDescription : copy.otpDescription}
            icon={<Icon name={iconName} size={30} className="text-secondary" />}
            footer={
                <View className="gap-3">
                    {inviteCode ? (
                        <View className="items-center">
                            <Text className="text-xs font-medium uppercase tracking-[1.2px] text-success">
                                Invite code
                            </Text>
                            <Text className="mt-1 text-sm text-muted">{inviteCode}</Text>
                        </View>
                    ) : null}
                    <Text className="text-center text-sm leading-5 text-muted">
                        {copy.footer}
                    </Text>
                </View>
            }
        >
            <AuthProgress currentStep={step} />

            {step === "phone" ? (
                <>
                    <Alert status={mode === "invite" ? "success" : "accent"}>
                        <Alert.Indicator />
                        <Alert.Content>
                            <Alert.Title>{copy.phoneAlertTitle}</Alert.Title>
                            <Alert.Description>
                                {copy.phoneAlertDescription}
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
                            autoFocus
                            value={phoneNumber}
                            onChangeText={(value) => {
                                setPhoneNumber(value);
                                setPhoneError(null);
                                setGeneralError(null);
                            }}
                            testID="input-phone"
                        />
                        <Description>
                            Use the exact number attached to your worker profile.
                        </Description>
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
                        onPress={() => void handleSendOtp("phone")}
                        isDisabled={loading}
                        testID="button-send-code"
                    >
                        {loading ? (
                            <Spinner size="sm" color={workerTheme.colors.white} />
                        ) : null}
                        <Button.Label>
                            {loading ? "Sending code" : "Send code"}
                        </Button.Label>
                    </Button>
                </>
            ) : (
                <>
                    <Alert status="success">
                        <Alert.Indicator />
                        <Alert.Content>
                            <Alert.Title>
                                {access?.existingAccount ? "Welcome back" : "Access confirmed"}
                            </Alert.Title>
                            <Alert.Description>
                                {accessMessage
                                    ? `${accessMessage} Enter the 6-digit code sent to ${phoneNumber}.`
                                    : `Enter the 6-digit code sent to ${phoneNumber}.`}
                            </Alert.Description>
                        </Alert.Content>
                    </Alert>

                    <View className="rounded-[24px] bg-default px-4 py-4">
                        <Text className="text-xs font-semibold uppercase tracking-[1.4px] text-muted">
                            Account status
                        </Text>
                        <Text className="mt-2 text-base font-medium text-foreground">
                            {access?.existingAccount
                                ? "Returning worker account"
                                : "First mobile sign-in"}
                        </Text>
                        <Text className="mt-1 text-sm leading-5 text-muted">
                            {access?.existingAccount
                                ? "After verification, we’ll take you back into your worker workspace."
                                : "After verification, your worker access will be activated for the businesses tied to this number."}
                        </Text>
                    </View>

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
                                    autoFocus: true,
                                    testID: "input-otp",
                                }}
                            >
                                <InputOTP.Group className="flex-row items-center justify-between gap-2">
                                    {[0, 1, 2].map((index) => (
                                        <InputOTP.Slot
                                            key={index}
                                            index={index}
                                            className="flex-1"
                                        />
                                    ))}
                                    <InputOTP.Separator className="w-2" />
                                    {[3, 4, 5].map((index) => (
                                        <InputOTP.Slot
                                            key={index}
                                            index={index}
                                            className="flex-1"
                                        />
                                    ))}
                                </InputOTP.Group>
                            </InputOTP>
                        </View>
                        <Description>
                            Use the newest code we texted to your phone.
                        </Description>
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
                            onPress={() => void handleVerify()}
                            isDisabled={loading}
                            testID="button-verify"
                        >
                            {loading ? (
                                <Spinner size="sm" color={workerTheme.colors.white} />
                            ) : null}
                            <Button.Label>
                                {loading
                                    ? "Verifying"
                                    : access?.existingAccount
                                      ? "Verify and sign in"
                                      : "Verify and continue"}
                            </Button.Label>
                        </Button>

                        <Button
                            variant="secondary"
                            onPress={() => void handleSendOtp("resend")}
                            isDisabled={loading}
                        >
                            <Button.Label>Resend code</Button.Label>
                        </Button>

                        <Button
                            variant="secondary"
                            onPress={resetToPhoneStep}
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
