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
import { cn } from "@repo/ui/lib/utils";
import { CrewMember, Role } from "@/hooks/use-crew-data";

export interface PositionItem {
    roleId: string;
    roleName: string;
    workerId?: string | null;
    workerName?: string;
    workerAvatar?: string;
    workerInitials?: string;
}

interface PositionSelectorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (selections: PositionItem[]) => void;
    roles: Role[];
    crew: CrewMember[];
}

export function PositionSelectorDialog({
    isOpen,
    onClose,
    onSelect,
    roles,
    crew
}: PositionSelectorDialogProps) {
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
        // Since "Open Shifts" are removed, we only toggle named crew.
        if (item.workerId) {
            const exists = selectedItems.find(i => i.workerId === item.workerId && i.roleId === item.roleId);
            if (exists) {
                setSelectedItems(prev => prev.filter(i => !(i.workerId === item.workerId && i.roleId === item.roleId)));
            } else {
                setSelectedItems(prev => [...prev, item]);
            }
        }
    };

    const isSelected = (workerId: string | null, roleId: string) => {
        if (!workerId) return false;
        return selectedItems.some(i => i.workerId === workerId && i.roleId === roleId);
    };

    const getRoleName = (id: string) => roles.find(r => r.id === id)?.label || "Role";

    const handleConfirm = () => {
        onSelect(selectedItems);
        setSelectedItems([]); // Clear buffer
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Select positions</DialogTitle>
                    <div className="relative mt-2">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search crew or roles..."
                            className="pl-9 rounded-full"
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

                    {/* 2. Crew Rows */}
                    {filteredCrew.map(worker => {
                        const isOvertime = worker.hours > 40;
                        const selected = isSelected(worker.id, activeTab === "all" ? ((worker.roles || [])[0] || "server") : activeTab);

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
                                                    {(worker.roles || [])[0] || "server"}
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
                                        roleId: activeTab === "all" ? ((worker.roles || [])[0] || "server") : activeTab,
                                        roleName: getRoleName(activeTab === "all" ? ((worker.roles || [])[0] || "server") : activeTab),
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
