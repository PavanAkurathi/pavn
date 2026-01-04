"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const bannerVariants = cva(
    "relative overflow-hidden rounded-lg shadow-md transition-all hover:shadow-lg active:scale-[0.995] w-full",
    {
        variants: {
            variant: {
                default: "bg-zinc-100 text-zinc-900",
                destructive: "bg-destructive text-white", // Brand Red -> White Text
                warning: "bg-role-support text-zinc-900", // Brand Yellow -> Dark Text
                success: "bg-role-host text-zinc-900", // Brand Green/Mint -> Dark Text
                info: "bg-blue-500 text-white", // Fallback info (Blue - strictly for info, ideally replaced by brand colors)

                // Semantic Roles (using global vars)
                server: "bg-role-server text-zinc-900", // Pale Orange -> Dark Text
                bartender: "bg-role-bartender text-zinc-900", // Pale Lavender -> Dark Text
                kitchen: "bg-role-kitchen text-zinc-900", // Pale Rose -> Dark Text
                host: "bg-role-host text-zinc-900", // Pale Mint -> Dark Text
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BannerProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bannerVariants> {
    icon?: React.ReactNode;
    action?: React.ReactNode;
}

function Banner({
    className,
    variant,
    icon,
    action,
    children,
    ...props
}: BannerProps) {
    return (
        <div className={cn(bannerVariants({ variant }), className)} {...props}>
            {/* Optional Gradient Overlay for Depth (matches ApprovalBanner style) */}
            <div className="absolute inset-0 bg-linear-to-r from-transparent to-black/5 pointer-events-none" />

            <div className="relative px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {icon && (
                        <div
                            className={cn(
                                "p-2 rounded-full shadow-sm ring-1 flex items-center justify-center shrink-0",
                                variant === "destructive" || variant === "info"
                                    ? "bg-white/20 ring-white/10 text-white"
                                    : "bg-zinc-900/10 ring-zinc-900/5 text-zinc-900"
                            )}
                        >
                            <div className="h-5 w-5 [&>svg]:h-full [&>svg]:w-full [&>svg]:stroke-[2.5]">
                                {icon}
                            </div>
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        {children}
                    </div>
                </div>

                {action && (
                    <div className="shrink-0">
                        {action}
                    </div>
                )}
            </div>
        </div>
    );
}

export { Banner, bannerVariants };
