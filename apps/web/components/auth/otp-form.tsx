"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@repo/ui/components/ui/input-otp";
import { Spinner } from "@repo/ui/components/ui/spinner";

interface OtpFormProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    isLoading?: boolean;
    submitLabel?: string;
    length?: number;
}

export function OtpForm({
    value,
    onChange,
    onSubmit,
    isLoading = false,
    submitLabel = "Verify",
    length = 6
}: OtpFormProps) {
    return (
        <div className="flex w-full flex-col items-center">
            <InputOTP
                maxLength={length}
                value={value}
                onChange={onChange}
            >
                <InputOTPGroup>
                    {Array.from({ length }).map((_, i) => (
                        <InputOTPSlot key={i} index={i} />
                    ))}
                </InputOTPGroup>
            </InputOTP>

            <Button
                className="mt-6 w-full"
                onClick={onSubmit}
                disabled={isLoading || value.length < length}
            >
                {isLoading ? <Spinner data-icon="inline-start" /> : null}
                {submitLabel}
            </Button>
        </div>
    );
}
