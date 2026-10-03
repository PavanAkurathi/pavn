"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { ManagerRequest } from "@repo/contracts/requests";
import { cn } from "@repo/ui/lib/utils";
import { PageTopBar } from "@/components/app-shell/page-top-bar";
import { REQUESTS_SUMMARY_KEY, fetchRequests, requestsKey } from "@/lib/scheduler/client";
import { RequestCard } from "./request-card";

type View = "pending" | "recent";

/** Requests grouped the way a manager thinks of them. */
const SECTIONS: { title: string; kinds: ManagerRequest["kind"][] }[] = [
    { title: "Time off", kinds: ["time_off"] },
    { title: "Shift swaps", kinds: ["swap"] },
    { title: "Open shifts and drops", kinds: ["claim", "drop"] },
];

export function RequestsView() {
    const [view, setView] = useState<View>("pending");
    const { mutate: mutateGlobal } = useSWRConfig();
    const { data, error, isLoading, mutate } = useSWR(requestsKey(view), fetchRequests, { keepPreviousData: true });
    const requests = data?.requests ?? [];

    const decided = async () => {
        await Promise.all([mutate(), mutateGlobal(REQUESTS_SUMMARY_KEY), mutateGlobal(requestsKey(view === "pending" ? "recent" : "pending"))]);
    };

    const waiting = data?.pendingCount ?? 0;
    const subtitle = data ? (waiting > 0 ? `${waiting} waiting for you` : "All caught up") : "Loading…";

    return (
        <div className="overflow-hidden rounded-card border bg-card">
            <PageTopBar
                title="Requests"
                subtitle={subtitle}
                actions={
                    <div role="group" aria-label="Show" className="flex h-8 items-center gap-0.5 rounded-control border bg-muted p-0.5">
                        {(
                            [
                                ["pending", "Waiting"],
                                ["recent", "Decided"],
                            ] as const
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={view === value}
                                onClick={() => setView(value)}
                                className={cn(
                                    "h-full rounded-chip px-3 text-xs font-semibold text-muted-foreground hover:text-foreground",
                                    view === value && "bg-card text-foreground shadow-sm",
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                }
            />

            <div className="bg-background p-4" aria-busy={isLoading}>
                <div className="max-w-[640px]">
                    {error ? (
                        <p role="alert" className="text-sm text-destructive">
                            Couldn&apos;t load requests: {error.message}
                        </p>
                    ) : null}

                    {!isLoading && !error && requests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {view === "pending"
                                ? "Nothing waiting. When someone asks for time off, a swap, a drop or an open shift in the app, it shows up here."
                                : "Nothing decided in the last two weeks."}
                        </p>
                    ) : null}

                    {SECTIONS.map(({ title, kinds }) => {
                        const items = requests.filter((r) => kinds.includes(r.kind));
                        if (items.length === 0) return null;
                        return (
                            <section key={title} aria-label={title} className="mb-4 last:mb-0">
                                <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">{title}</h2>
                                <div className="flex flex-col gap-2.5">
                                    {items.map((r) => (
                                        <RequestCard key={`${r.id}:${r.status}`} request={r} onDecided={decided} />
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
