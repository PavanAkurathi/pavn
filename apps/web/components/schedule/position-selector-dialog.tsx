"use client";

import { useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Search, Plus, Check, AlertTriangle, User } from "lucide-react";
import { useCrewData } from "@/hooks/use-crew-data";
import { cn } from "@repo/ui/lib/utils";

export interface PositionItem {
    roleId: string;
    roleName: string;
    workerId: string | null;
    workerName?: string;
    workerAvatar?: string;
    workerInitials?: string;
}

interface PositionSelectorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (selections: PositionItem[]) => void;
}

export function PositionSelectorDialog({ isOpen, onClose, onSelect }: PositionSelectorDialogProps) {
    const { roles, crew } = useCrewData();
    const [activeTab, setActiveTab] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedItems, setSelectedItems] = useState<PositionItem[]>([]);

    // Filter Logic
    const filteredCrew = useMemo(() => {
        return crew.filter(worker => {
            const matchesTab = activeTab === "all" || worker.roles.includes(activeTab);
            const matchesSearch = worker.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesTab && matchesSearch;
        });
    }, [crew, activeTab, searchQuery]);

    // Handle Adding/Removing from buffer
    const toggleSelection = (item: PositionItem) => {
        // Since we can add multiple "Open Shifts" or multiple "Crew", we just append to the list
        // Requirement: "The 'Add' button toggles to 'Added'". 
        // Note: For unique crew members, we might want to toggle. For "Open Shift", we always add.
        // Let's implement simple append for now, but UI feedback requires checking if in array.
        // Wait, for unique workers, usually you select once per slot. 
        // But the requirement says "Bulk Adding". 
        // If I click "Add" on "Mike Ross", he is added. If I click again, do I add him twice? Probably not for the same block.
        // Let's assume toggle for crew, always add for "Open Shift"? 
        // Requirement: "The 'Add' button toggles to 'Added' (Green variant)."

        // For CREW: Toggle
        if (item.workerId) {
            const exists = selectedItems.find(i => i.workerId === item.workerId && i.roleId === item.roleId);
            if (exists) {
                setSelectedItems(prev => prev.filter(i => !(i.workerId === item.workerId && i.roleId === item.roleId)));
            } else {
                setSelectedItems(prev => [...prev, item]);
            }
        } else {
            // For OPEN SHIFTS: We can add multiple. But the "Toggle" UI implies a state. 
            // To support multiple "Open Shifts", maybe we allow clicking it multiple times and it adds to the count? 
            // Or simpler: Just add one "Open Shift" entry per click, and show "Added x2" if needed?
            // Let's stick to simple: "Open Shift" adds one entry. 
            setSelectedItems(prev => [...prev, item]);
        }
    };

    const isSelected = (workerId: string | null, roleId: string) => {
        if (!workerId) return false; // Open shifts don't show "selected" state persistence in this simple model, or maybe they do?
        // Actually, for Open Shifts, usually you just click "Add" and it sends it. 
        // But the requirement says "Click 'Done' to close". So we need a buffer.
        return selectedItems.some(i => i.workerId === workerId && i.roleId === roleId);
    };

    const getRoleName = (id: string) => roles.find(r => r.id === id)?.label || "Role";

    const handleConfirm = () => {
        onSelect(selectedItems);
        setSelectedItems([]); // Clear buffer
        onClose();
    };

    const handleOpenShiftClick = () => {
        // Add an open shift for the current active tab (or default to 'server' if 'all'?)
        // If 'All' is selected, we probably shouldn't show "Open Shift" unless we force a role picker.
        // Let's assume if 'All', we show Open Shifts for ALL roles? Or just hide it? 
        // Better UX: Show "Open Position" card that forces role selection? 
        // Simplified: If 'All' is active, disable "Open Shift" row or default to something?
        // Let's filter "Open Shift" row based on activeTab. 

        // If activeTab is 'all', we can't easily add an "Open Shift" without knowing the role.
        // So maybe we only show the "Open Shift" row when a specific role tab is active.

        if (activeTab !== "all") {
            const newItem: PositionItem = {
                roleId: activeTab,
                roleName: getRoleName(activeTab),
                workerId: null
            };
            setSelectedItems(prev => [...prev, newItem]);
        }
    };

    // Count open shifts in buffer for the current tab
    const openShiftsCount = selectedItems.filter(i => i.workerId === null && i.roleId === activeTab).length;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Select positions</DialogTitle>
                    <div className="relative mt-2">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search crew or roles..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </DialogHeader>

                {/* Tabs */}
                <div className="px-6 border-b">
                    <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                        {roles.map(role => (
                            <button
                                key={role.id}
                                onClick={() => setActiveTab(role.id)}
                                className={cn(
                                    "px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                                    activeTab === role.id
                                        ? "bg-black text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                )}
                            >
                                {role.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* 1. Open Shift Row (Only if specific role selected) */}
                    {activeTab !== "all" && (
                        <div className="flex items-center justify-between p-3 border rounded-lg border-dashed hover:bg-gray-50 transition-colors">
                            <div className="flex items-center space-x-3">
                                <div className="h-10 w-10 rounded-full border-2 border-dashed flex items-center justify-center text-muted-foreground">
                                    <User className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-semibold">Open {getRoleName(activeTab)} Shift</p>
                                    <p className="text-sm text-muted-foreground">Unassigned position</p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant={openShiftsCount > 0 ? "default" : "outline"}
                                className={cn(openShiftsCount > 0 && "bg-green-600 hover:bg-green-700")}
                                onClick={handleOpenShiftClick}
                            >
                                {openShiftsCount > 0 ? `Added (${openShiftsCount})` : "Add"}
                                {openShiftsCount > 0 ? <Check className="ml-2 h-4 w-4" /> : <Plus className="ml-2 h-4 w-4" />}
                            </Button>
                        </div>
                    )}

                    {/* 2. Crew Rows */}
                    {filteredCrew.map(worker => {
                        const isOvertime = worker.hours > 40;
                        const selected = isSelected(worker.id, activeTab === "all" ? (worker.roles[0] || "server") : activeTab);

                        return (
                            <div key={worker.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="flex items-center space-x-3">
                                    <Avatar>
                                        <AvatarImage src={worker.avatar} />
                                        <AvatarFallback>{worker.initials}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold">{worker.name}</p>
                                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                            {/* Show Primary Role if 'All' is active, otherwise implicit */}
                                            {activeTab === "all" && (
                                                <Badge variant="secondary" className="text-xs h-5 px-1.5 font-normal">
                                                    {worker.roles[0]}
                                                </Badge>
                                            )}
                                            <span className={cn(isOvertime && "text-red-600 font-medium flex items-center")}>
                                                {worker.hours} hrs
                                                {isOvertime && <AlertTriangle className="ml-1 h-3 w-3" />}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant={selected ? "default" : "outline"}
                                    className={cn(selected && "bg-green-600 hover:bg-green-700")}
                                    onClick={() => toggleSelection({
                                        roleId: activeTab === "all" ? (worker.roles[0] || "server") : activeTab,
                                        roleName: getRoleName(activeTab === "all" ? (worker.roles[0] || "server") : activeTab),
                                        workerId: worker.id,
                                        workerName: worker.name,
                                        workerAvatar: worker.avatar,
                                        workerInitials: worker.initials
                                    })}
                                >
                                    {selected ? "Added" : "Add"}
                                    {selected ? <Check className="ml-2 h-4 w-4" /> : <Plus className="ml-2 h-4 w-4" />}
                                </Button>
                            </div>
                        );
                    })}

                    {filteredCrew.length === 0 && activeTab !== "all" && (
                        <div className="text-center py-8 text-muted-foreground">
                            No active crew found for {getRoleName(activeTab)}.
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 border-t">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={selectedItems.length === 0}>
                        Done ({selectedItems.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
