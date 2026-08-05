"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";

export function PrintToolbar() {
    const router = useRouter();

    return (
        <div className="print-hidden mb-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.back()}>
                <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                Back
            </Button>
            <Button onClick={() => window.print()}>
                <Printer data-icon="inline-start" aria-hidden="true" />
                Print
            </Button>
        </div>
    );
}
