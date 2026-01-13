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
import { cn } from "@repo/ui/lib/utils";

interface AddWorkerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (workerIds: string[]) => void;
    existingWorkerIds?: string[];
}

export function AddWorkerDialog({ isOpen, onClose, onConfirm, existingWorkerIds = [] }: AddWorkerDialogProps) {
    const { crew, isLoading } = useCrewData();
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedWorkerIds, setSelectedWorkerIds] = React.useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Filter crew based on search and exclude already assigned workers
    const filteredCrew = React.useMemo(() => {
        if (!crew) return [];
        return crew.filter((worker) => {
            const isAlreadyAssigned = existingWorkerIds.includes(worker.id);
            if (isAlreadyAssigned) return false;

            const matchesSearch = worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                worker.roles.some(r => r.toLowerCase().includes(searchQuery.toLowerCase()));

            return matchesSearch;
        });
    }, [crew, searchQuery, existingWorkerIds]);

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
            // Mimic async operation if needed, or just pass up
            await onConfirm(selectedWorkerIds);
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
            <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <UserPlus className="h-5 w-5 text-indigo-600" />
                        Add Pros to Shift
                    </DialogTitle>
                    <DialogDescription>
                        Search and select crew members to add to this shift immediately.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search names or roles..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-md"
                        />
                    </div>
                </div>

                <div className="flex flex-col h-[300px]">
                    {isLoading ? (
                        <div className="flex flex-1 items-center justify-center text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            Loading crew...
                        </div>
                    ) : filteredCrew.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-2">
                            <User className="h-8 w-8 opacity-20" />
                            <p>No available workers found.</p>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1">
                            <div className="px-6 py-2 space-y-1">
                                {filteredCrew.map((worker) => {
                                    const isSelected = selectedWorkerIds.includes(worker.id);
                                    return (
                                        <div
                                            key={worker.id}
                                            onClick={() => toggleWorker(worker.id)}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border",
                                                isSelected
                                                    ? "bg-indigo-50 border-indigo-200"
                                                    : "hover:bg-muted border-transparent"
                                            )}
                                        >
                                            <div className="relative">
                                                <Avatar className="h-10 w-10 border border-border">
                                                    <AvatarImage src={worker.avatar} alt={worker.name} />
                                                    <AvatarFallback>{worker.initials}</AvatarFallback>
                                                </Avatar>
                                                {isSelected && (
                                                    <div className="absolute -top-1 -right-1 bg-indigo-600 rounded-full p-0.5 border-2 border-white">
                                                        <Check className="h-3 w-3 text-white" />
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

                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className={cn(
                                                    "h-8 w-8 rounded-full",
                                                    isSelected ? "text-indigo-600 bg-indigo-100/50" : "text-muted-foreground"
                                                )}
                                            >
                                                {isSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                            </Button>
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
                            {selectedWorkerIds.length} select{selectedWorkerIds.length !== 1 ? 'ed' : ''}
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleClose}>Cancel</Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={selectedWorkerIds.length === 0 || isSubmitting}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : (
                                    <>Add to Shift</>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
