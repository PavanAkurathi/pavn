// apps/web/components/roster/availability-list.tsx
"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar, Loader2 } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { authClient } from "@repo/auth/client";

interface AvailabilityRecord {
    id: string;
    startTime: string;
    endTime: string;
    type: "unavailable" | "preferred";
    reason?: string;
}

interface AvailabilityListProps {
    workerId: string;
}

export function AvailabilityList({ workerId }: AvailabilityListProps) {
    const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const { data: org } = authClient.useActiveOrganization();

    useEffect(() => {
        if (!org?.id || !workerId) return;

        const load = async () => {
            setLoading(true);
            try {
                // Fetch next 30 days
                const start = new Date().toISOString();
                const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

                // Use Hono Service URL (Proxied or Direct - assuming localhost:4005 for dev)
                const res = await fetch(`http://localhost:4005/organizations/${org.id}/availability?from=${start}&to=${end}&workerId=${workerId}`);
                if (res.ok) {
                    const data = await res.json();
                    setAvailability(data);
                }
            } catch (e) {
                console.error("Failed to load availability", e);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [org?.id, workerId]);

    if (loading) {
        return <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading availability...</div>;
    }

    if (availability.length === 0) {
        return <div className="text-sm text-muted-foreground italic">No upcoming unavailability set.</div>;
    }

    return (
        <div className="space-y-2">
            {availability.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2 bg-slate-50 border rounded-md text-sm">
                    <div className="flex flex-col">
                        <span className="font-medium text-slate-700">
                            {format(new Date(item.startTime), "MMM d, yyyy")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {format(new Date(item.startTime), "h:mm a")} - {format(new Date(item.endTime), "h:mm a")}
                        </span>
                    </div>
                    <div className="ml-auto">
                        {item.type === 'unavailable' ? (
                            <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">Unavailable</Badge>
                        ) : (
                            <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Preferred</Badge>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
