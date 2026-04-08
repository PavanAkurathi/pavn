"use client";

import * as React from "react";
import { Check, Loader2, Plus, Search, User, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { useCrewData } from "@/hooks/use-crew-data";
import { getDashboardMockCrew } from "@/lib/shifts/data";
import { cn } from "@repo/ui/lib/utils";

export interface AddWorkerSelection {
    id: string;
    name: string;
    avatar?: string;
    initials: string;
}

interface AddWorkerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (workers: AddWorkerSelection[]) => Promise<void> | void;
    existingWorkerIds?: string[];
}

export function AddWorkerDialog({ isOpen, onClose, onConfirm, existingWorkerIds = [] }: AddWorkerDialogProps) {
    const { crew, isLoading } = useCrewData();
    const workerPool = React.useMemo(
        () => (crew.length > 0 ? crew : (process.env.NODE_ENV !== "production" ? getDashboardMockCrew() : [])),
        [crew],
    );
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedWorkerIds, setSelectedWorkerIds] = React.useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const filteredCrew = React.useMemo(() => {
        return workerPool.filter((worker) => {
            const isAlreadyAssigned = existingWorkerIds.includes(worker.id);
            if (isAlreadyAssigned) return false;

            const matchesSearch = worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                worker.roles.some(r => r.toLowerCase().includes(searchQuery.toLowerCase()));

            return matchesSearch;
        });
    }, [workerPool, searchQuery, existingWorkerIds]);

    const toggleWorker = (workerId: string) => {
        setSelectedWorkerIds(prev =>
            prev.includes(workerId)
                ? prev.filter(id => id !== workerId)
                : [...prev, workerId]
        );
    };

    const handleConfirm = async () => {
        if (selectedWorkerIds.length === 0) return;
        setIsSubmitting(true);
        try {
            const selectedWorkers = workerPool
                .filter((worker) => selectedWorkerIds.includes(worker.id))
                .map((worker) => ({
                    id: worker.id,
                    name: worker.name,
                    avatar: worker.avatar,
                    initials: worker.initials,
                }));

            await onConfirm(selectedWorkers);
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
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[500px] gap-0 overflow-hidden p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <UserPlus className="text-primary" />
                        Add worker to shift
                    </DialogTitle>
                    <DialogDescription>
                        Search and select available team members to add immediately.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search names or roles..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="rounded-md border-none bg-muted/50 pl-9"
                        />
                    </div>
                </div>

                <div className="flex flex-col h-[300px]">
                    {isLoading ? (
                        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="animate-spin" />
                            Loading crew...
                        </div>
                    ) : filteredCrew.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-2">
                            <User className="opacity-20" />
                            <p>No available workers found.</p>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1">
                            <div className="flex flex-col gap-1 px-6 py-2">
                                {filteredCrew.map((worker) => {
                                    const isSelected = selectedWorkerIds.includes(worker.id);
                                    return (
                                        <div
                                            key={worker.id}
                                            onClick={() => toggleWorker(worker.id)}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border",
                                                isSelected
                                                    ? "border-primary/20 bg-primary/5"
                                                    : "hover:bg-muted border-transparent"
                                            )}
                                        >
                                            <div className="relative">
                                                <Avatar className="size-10 border border-border">
                                                    <AvatarImage src={worker.avatar} alt={worker.name} />
                                                    <AvatarFallback>{worker.initials}</AvatarFallback>
                                                </Avatar>
                                                {isSelected && (
                                                    <div className="absolute -top-1 -right-1 rounded-full border-2 border-white bg-primary p-0.5">
                                                        <Check className="text-primary-foreground" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">{worker.name}</div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {worker.roles.slice(0, 2).map(role => (
                                                        <Badge key={role} variant="secondary" className="text-[10px] px-1 h-5 font-normal text-muted-foreground">
                                                            {role}
                                                        </Badge>
                                                    ))}
                                                    {worker.roles.length > 2 && (
                                                        <span className="text-[10px] text-muted-foreground flex items-center">+{worker.roles.length - 2}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div
                                                aria-hidden="true"
                                                className={cn(
                                                    "flex size-8 items-center justify-center rounded-full",
                                                    isSelected ? "bg-primary/10 text-primary" : "text-muted-foreground"
                                                )}
                                            >
                                                {isSelected ? <Check /> : <Plus />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="p-6 pt-4 border-t bg-muted/20">
                    <div className="flex items-center justify-between w-full">
                        <span className="text-sm text-muted-foreground font-medium">
                            {selectedWorkerIds.length} selected
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleClose}>Cancel</Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={selectedWorkerIds.length === 0 || isSubmitting}
                                className="min-w-[120px]"
                            >
                                {isSubmitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <UserPlus data-icon="inline-start" />}
                                {isSubmitting ? "Adding..." : "Add worker"}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
