"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@repo/ui/components/ui/input-otp";

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
        <div className="flex flex-col items-center w-full">
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
                className="w-full mt-6 bg-red-600 hover:bg-red-700 font-bold"
                onClick={onSubmit}
                disabled={isLoading || value.length < length}
            >
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                {submitLabel}
            </Button>
        </div>
    );
}
