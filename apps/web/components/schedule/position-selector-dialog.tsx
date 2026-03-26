"use client";

import { useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@repo/ui/components/ui/empty";
import { Search, Plus, Check, AlertTriangle, Users } from "lucide-react";
import { CrewMember, Role } from "@/hooks/use-crew-data";
import { getRoleLabel } from "@/lib/schedule/roles";

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
    const [customRoleName, setCustomRoleName] = useState("");
    const [selectedItems, setSelectedItems] = useState<PositionItem[]>([]);

    const normalizedCustomRole = getRoleLabel(customRoleName);

    // Filter Logic
    const filteredCrew = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return crew.filter(worker => {
            const matchesTab = activeTab === "all" || worker.roles.includes(activeTab);
            const matchesSearch =
                query.length === 0 ||
                worker.name.toLowerCase().includes(query) ||
                worker.roles.some(role => getRoleLabel(role).toLowerCase().includes(query));
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

    const getRoleName = (id: string) => roles.find(r => r.id === id)?.label || getRoleLabel(id);

    const handleConfirm = () => {
        onSelect(selectedItems);
        setSelectedItems([]); // Clear buffer
        setCustomRoleName("");
        onClose();
    };

    const handleAddOpenSlot = () => {
        if (activeTab === "all" && !customRoleName.trim()) {
            return;
        }

        onSelect([
            ...selectedItems,
            {
                roleId: customRoleName.trim() ? normalizedCustomRole : activeTab,
                roleName: customRoleName.trim() ? normalizedCustomRole : getRoleName(activeTab),
            },
        ]);
        setSelectedItems([]);
        setCustomRoleName("");
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Select positions</DialogTitle>
                    <DialogDescription>
                        Assign crew members to this schedule block or add open slots for uncovered roles.
                    </DialogDescription>
                    <div className="relative mt-2">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search crew or roles..."
                            className="pl-9 rounded-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Input
                        placeholder="Create custom role, e.g. Cashier or Forklift Operator"
                        className="mt-3 rounded-full"
                        value={customRoleName}
                        onChange={(e) => setCustomRoleName(e.target.value)}
                    />
                </DialogHeader>

                {/* Tabs */}
                <div className="px-6 border-b">
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {roles.map(role => (
                            <Button
                                key={role.id}
                                type="button"
                                size="sm"
                                variant={activeTab === role.id ? "default" : "outline"}
                                onClick={() => setActiveTab(role.id)}
                                className="whitespace-nowrap"
                            >
                                {role.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="divide-y border rounded-md">
                        {filteredCrew.map(worker => {
                            const isOvertime = worker.hours > 40;
                            const currentRoleId = customRoleName.trim()
                                ? normalizedCustomRole
                                : (activeTab === "all" ? ((worker.roles || [])[0] || "General") : activeTab);
                            const selected = isSelected(worker.id, currentRoleId);

                            return (
                                <div
                                    key={worker.id}
                                    className="grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-4 bg-background p-3 transition-colors hover:bg-accent/30"
                                    onClick={() => toggleSelection({
                                        roleId: currentRoleId,
                                        roleName: getRoleName(currentRoleId),
                                        workerId: worker.id,
                                        workerName: worker.name,
                                        workerAvatar: worker.avatar,
                                        workerInitials: worker.initials
                                    })}
                                    data-testid="position-item"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Avatar className="size-9 shrink-0">
                                            <AvatarImage src={worker.avatar} />
                                            <AvatarFallback className="text-xs">{worker.initials}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 truncate">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate text-sm font-medium leading-none text-foreground">{worker.name}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="hidden whitespace-nowrap px-4 text-right sm:block">
                                        <Badge variant={isOvertime ? "destructive" : "secondary"} className="gap-1">
                                            {isOvertime ? <AlertTriangle className="size-3" /> : null}
                                            {worker.hours} hrs
                                        </Badge>
                                    </div>

                                    <div className="shrink-0">
                                        <Button
                                            size="sm"
                                            variant={selected ? "default" : "outline"}
                                            className="min-w-[90px]"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleSelection({
                                                    roleId: currentRoleId,
                                                    roleName: getRoleName(currentRoleId),
                                                    workerId: worker.id,
                                                    workerName: worker.name,
                                                    workerAvatar: worker.avatar,
                                                    workerInitials: worker.initials
                                                });
                                            }}
                                        >
                                            {selected ? (
                                                <>
                                                    Added <Check data-icon="inline-end" className="size-3" />
                                                </>
                                            ) : (
                                                <>
                                                    Add <Plus data-icon="inline-end" className="size-3" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}

                        {filteredCrew.length === 0 && activeTab !== "all" && (
                            <Empty className="border-0 rounded-none py-10">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <Users />
                                    </EmptyMedia>
                                    <EmptyTitle>No active crew for {getRoleName(activeTab)}</EmptyTitle>
                                    <EmptyDescription>
                                        Switch roles, create an open slot, or add workers for this role first.
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        )}
                        {filteredCrew.length === 0 && activeTab === "all" && (
                            <Empty className="border-0 rounded-none py-10">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <Users />
                                    </EmptyMedia>
                                    <EmptyTitle>No crew members found</EmptyTitle>
                                    <EmptyDescription>
                                        Add workers first, or create an open slot to keep this schedule moving.
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-6 border-t">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddOpenSlot}
                        disabled={activeTab === "all" && !customRoleName.trim()}
                    >
                        {customRoleName.trim() ? `Add ${normalizedCustomRole} slot` : "Add open slot"}
                    </Button>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={selectedItems.length === 0} data-testid="confirm-positions">
                        Done ({selectedItems.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
