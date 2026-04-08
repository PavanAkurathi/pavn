import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="flex flex-col space-y-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-8 w-36" />
                    <Skeleton className="h-5 w-24" />
                </div>
            </div>

            <Card className="rounded-[28px] border-border/70 shadow-sm">
                <CardContent className="flex flex-col gap-6 p-6">
                    <div className="space-y-3">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-5 w-56" />
                        <Skeleton className="h-5 w-80 max-w-full" />
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-muted/30 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-start gap-3">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-44" />
                                    <Skeleton className="h-4 w-80 max-w-full" />
                                </div>
                            </div>
                            <Skeleton className="h-10 w-28 rounded-full" />
                        </div>
                    </div>

                    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-4 pb-4">
                            <Skeleton className="h-10 w-64 max-w-full" />
                            <div className="flex gap-2">
                                <Skeleton className="h-9 w-20" />
                                <Skeleton className="h-9 w-28" />
                            </div>
                        </div>

                        {Array.from({ length: 2 }).map((_, index) => (
                            <div key={index} className="flex items-center gap-4 border-t border-border py-4 first:border-t-0">
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <Skeleton className="h-10 flex-1" />
                                <Skeleton className="h-10 w-32" />
                                <Skeleton className="h-10 w-32" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
