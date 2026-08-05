"use client";

import * as React from "react";
import useSWR from "swr";
import { Check, Loader2, Plus, Search, User, UserPlus, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { useCrewData } from "@/hooks/use-crew-data";
import { useOrganizationId } from "@/hooks/use-schedule-data";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@repo/ui/lib/utils";

export interface AddWorkerSelection {
    id: string;
    name: string;
    avatar?: string;
    initials: string;
    /** Agency/temp workers have no app account; the manager keys their times. */
    isTemp?: boolean;
    agency?: string;
    /** Invited in-house worker who hasn't accepted yet (roster entry id). */
    invitePending?: boolean;
}

interface TempWorkerRecord {
    id: string;
    name: string;
    agency?: string | null;
}

interface AddWorkerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (workers: AddWorkerSelection[]) => Promise<void> | void;
    existingWorkerIds?: string[];
}

const tempInitials = (name: string) =>
    name
        .split(" ")
        .map((part) => part[0] || "")
        .join("")
        .slice(0, 2)
        .toUpperCase() || "T";

export function AddWorkerDialog({ isOpen, onClose, onConfirm, existingWorkerIds = [] }: AddWorkerDialogProps) {
    const { crew, isLoading } = useCrewData();
    const orgId = useOrganizationId();
    const tempsUrl = orgId ? `/api/organizations/${orgId}/temp-workers` : null;
    const { data: temps, isLoading: tempsLoading, mutate: mutateTemps } = useSWR<TempWorkerRecord[]>(tempsUrl, fetcher);

    const [tab, setTab] = React.useState<"roster" | "temps">("roster");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedWorkerIds, setSelectedWorkerIds] = React.useState<string[]>([]);
    const [selectedTempIds, setSelectedTempIds] = React.useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Quick-add temps
    const [agencyInput, setAgencyInput] = React.useState("");
    const [namesInput, setNamesInput] = React.useState("");
    const [countInput, setCountInput] = React.useState("");
    const [isCreatingTemps, setIsCreatingTemps] = React.useState(false);

    const filteredCrew = React.useMemo(() => {
        return crew.filter((worker) => {
            if (existingWorkerIds.includes(worker.id)) return false;
            return (
                worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                worker.roles.some((r) => r.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        });
    }, [crew, searchQuery, existingWorkerIds]);

    const filteredTemps = React.useMemo(() => {
        return (temps ?? []).filter((temp) => {
            if (existingWorkerIds.includes(temp.id)) return false;
            const haystack = `${temp.name} ${temp.agency ?? ""}`.toLowerCase();
            return haystack.includes(searchQuery.toLowerCase());
        });
    }, [temps, searchQuery, existingWorkerIds]);

    const toggle = (id: string, kind: "roster" | "temps") => {
        const setter = kind === "roster" ? setSelectedWorkerIds : setSelectedTempIds;
        setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const handleQuickAddTemps = async () => {
        if (!orgId) return;
        const names = namesInput.split(",").map((n) => n.trim()).filter(Boolean);
        const count = parseInt(countInput, 10);
        if (names.length === 0 && (!count || count < 1)) return;

        setIsCreatingTemps(true);
        try {
            const res = await fetch(tempsUrl!, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    agency: agencyInput.trim() || undefined,
                    names: names.length > 0 ? names : undefined,
                    count: names.length === 0 ? count : undefined,
                }),
            });
            if (!res.ok) throw new Error("Failed to add temps");
            const created: TempWorkerRecord[] = await res.json();
            await mutateTemps();
            setSelectedTempIds((prev) => [...prev, ...created.map((t) => t.id)]);
            setNamesInput("");
            setCountInput("");
        } catch (error) {
            console.error("Failed to create temp workers", error);
        } finally {
            setIsCreatingTemps(false);
        }
    };

    const selectionCount = selectedWorkerIds.length + selectedTempIds.length;

    const handleConfirm = async () => {
        if (selectionCount === 0) return;
        setIsSubmitting(true);
        try {
            const rosterSelections: AddWorkerSelection[] = crew
                .filter((worker) => selectedWorkerIds.includes(worker.id))
                .map((worker) => ({
                    id: worker.id,
                    name: worker.name,
                    avatar: worker.avatar,
                    initials: worker.initials,
                    invitePending: worker.invitePending,
                }));

            const tempSelections: AddWorkerSelection[] = (temps ?? [])
                .filter((temp) => selectedTempIds.includes(temp.id))
                .map((temp) => ({
                    id: temp.id,
                    name: temp.name,
                    initials: tempInitials(temp.name),
                    isTemp: true,
                    agency: temp.agency ?? undefined,
                }));

            await onConfirm([...rosterSelections, ...tempSelections]);
            handleClose();
        } catch (error) {
            console.error("Failed to add workers", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSearchQuery("");
        setSelectedWorkerIds([]);
        setSelectedTempIds([]);
        setTab("roster");
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[520px] gap-0 overflow-hidden p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <UserPlus aria-hidden="true" className="text-primary" />
                        Add Worker to Shift
                    </DialogTitle>
                    <DialogDescription>
                        Pick from your roster, or add temp/agency workers on the fly.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 pt-2">
                    <Tabs value={tab} onValueChange={(value) => setTab(value === "temps" ? "temps" : "roster")}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="roster">
                                <User aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                Roster
                                {selectedWorkerIds.length > 0 ? ` (${selectedWorkerIds.length})` : ""}
                            </TabsTrigger>
                            <TabsTrigger value="temps">
                                <Users aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                Temps
                                {selectedTempIds.length > 0 ? ` (${selectedTempIds.length})` : ""}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="px-6 py-2">
                    <div className="relative">
                        <Search aria-hidden="true" className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={tab === "roster" ? "Search names or roles…" : "Search temps or agencies…"}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="rounded-md border-none bg-muted/50 pl-9"
                        />
                    </div>
                </div>

                {tab === "temps" && (
                    <div className="mx-6 mb-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                            New temps — type names, or just a count for “Temp 1, Temp 2…” placeholders you can rename later.
                        </p>
                        <div className="flex flex-col gap-2">
                            <Input
                                placeholder="Names, comma-separated (optional)"
                                value={namesInput}
                                onChange={(e) => setNamesInput(e.target.value)}
                                className="h-8 text-sm"
                            />
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Agency (optional)"
                                    value={agencyInput}
                                    onChange={(e) => setAgencyInput(e.target.value)}
                                    className="h-8 flex-1 text-sm"
                                />
                                <Input
                                    placeholder="Count"
                                    type="number"
                                    min={1}
                                    max={50}
                                    inputMode="numeric"
                                    value={countInput}
                                    onChange={(e) => setCountInput(e.target.value)}
                                    className="h-8 w-20 text-sm"
                                    disabled={namesInput.trim().length > 0}
                                />
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={handleQuickAddTemps}
                                    disabled={isCreatingTemps || (!namesInput.trim() && !countInput)}
                                >
                                    {isCreatingTemps ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}
                                    Add
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex h-[260px] flex-col">
                    {(tab === "roster" ? isLoading : tempsLoading) ? (
                        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 aria-hidden="true" className="animate-spin" />
                            Loading…
                        </div>
                    ) : (tab === "roster" ? filteredCrew.length === 0 : filteredTemps.length === 0) ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                            <User aria-hidden="true" className="opacity-20" />
                            <p>{tab === "roster" ? "No available roster workers." : "No temps yet — add some above."}</p>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1">
                            <div className="flex flex-col gap-1 px-6 py-2">
                                {tab === "roster"
                                    ? filteredCrew.map((worker) => {
                                        const isSelected = selectedWorkerIds.includes(worker.id);
                                        return (
                                            <button
                                                type="button"
                                                key={worker.id}
                                                onClick={() => toggle(worker.id, "roster")}
                                                className={cn(
                                                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    isSelected ? "border-primary/20 bg-primary/5" : "border-transparent hover:bg-muted",
                                                )}
                                            >
                                                <Avatar className="size-10 border border-border">
                                                    <AvatarImage src={worker.avatar} alt="" />
                                                    <AvatarFallback>{worker.initials}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="truncate text-sm font-medium">{worker.name}</span>
                                                        {worker.invitePending ? (
                                                            <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] font-normal text-muted-foreground">
                                                                Invited
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {worker.roles.slice(0, 2).map((role) => (
                                                            <Badge key={role} variant="secondary" className="h-5 px-1 text-[10px] font-normal text-muted-foreground">
                                                                {role}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                                <span aria-hidden="true" className={cn("flex size-8 items-center justify-center rounded-full", isSelected ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
                                                    {isSelected ? <Check /> : <Plus />}
                                                </span>
                                            </button>
                                        );
                                    })
                                    : filteredTemps.map((temp) => {
                                        const isSelected = selectedTempIds.includes(temp.id);
                                        return (
                                            <button
                                                type="button"
                                                key={temp.id}
                                                onClick={() => toggle(temp.id, "temps")}
                                                className={cn(
                                                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    isSelected ? "border-primary/20 bg-primary/5" : "border-transparent hover:bg-muted",
                                                )}
                                            >
                                                <Avatar className="size-10 border border-dashed border-border">
                                                    <AvatarFallback>{tempInitials(temp.name)}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-medium">{temp.name}</div>
                                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                                        {temp.agency || "Temp worker"}
                                                    </div>
                                                </div>
                                                <span aria-hidden="true" className={cn("flex size-8 items-center justify-center rounded-full", isSelected ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
                                                    {isSelected ? <Check /> : <Plus />}
                                                </span>
                                            </button>
                                        );
                                    })}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="border-t bg-muted/20 p-6 pt-4">
                    <div className="flex w-full items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                            {selectionCount} selected
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleClose}>Cancel</Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={selectionCount === 0 || isSubmitting}
                                className="min-w-[120px]"
                            >
                                {isSubmitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <UserPlus data-icon="inline-start" />}
                                {isSubmitting ? "Adding…" : "Add to Shift"}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
