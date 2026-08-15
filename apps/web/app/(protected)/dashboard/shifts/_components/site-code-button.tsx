"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { revealSiteCodeAction } from "../_actions/site-code";

/**
 * The way through when the geofence is wrong.
 *
 * Hidden until asked for. A code sitting on screen all day becomes the normal
 * way people clock in, and the whole point is that it is the exception — every
 * use is recorded as unverified and lands in the manager's review queue.
 */
export function SiteCodeButton({ shiftId }: { shiftId: string }) {
    const [code, setCode] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);

    const reveal = async () => {
        setIsLoading(true);
        try {
            const result = await revealSiteCodeAction(shiftId);
            if ("error" in result) {
                toast.error(result.error);
                return;
            }
            setCode(result.code);
        } finally {
            setIsLoading(false);
        }
    };

    if (code) {
        return (
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                <KeyRound className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
                <div className="text-sm">
                    <span className="font-mono text-lg font-bold tracking-[0.3em] text-amber-900">
                        {code}
                    </span>
                    <p className="text-xs text-amber-800/80">
                        Read this out to anyone who cannot clock in. It is recorded as unverified.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <Button variant="outline" onClick={reveal} disabled={isLoading}>
            <KeyRound data-icon="inline-start" aria-hidden="true" />
            {isLoading ? "Getting code…" : "Site code"}
        </Button>
    );
}
