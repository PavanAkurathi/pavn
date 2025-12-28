"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { X, User } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface PositionChipsProps {
    fields: any[]; // Fields from useFieldArray
    onRemove: (index: number) => void;
}

export function PositionChips({ fields, onRemove }: PositionChipsProps) {
    // Group items by role
    const grouped = fields.reduce((acc, field, index) => {
        const role = field.roleName || "Unassigned";
        if (!acc[role]) acc[role] = [];
        // We store the original index to allow removal from the main array
        acc[role].push({ ...field, originalIndex: index });
        return acc;
    }, {} as Record<string, any[]>);

    return (
        <div className="space-y-4">
            {(Object.entries(grouped) as [string, any[]][]).map(([role, items]) => (
                <div key={role} className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2 pl-1">
                        {role} <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-600 border font-bold">{items.length}</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {items.map((item: any) => (
                            <div
                                key={item.id}
                                className={cn(
                                    "flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-md border text-sm transition-colors group select-none animate-in fade-in zoom-in-95 duration-200 shadow-sm",
                                    item.workerId ? "bg-white border-slate-200" : "bg-slate-50 border-dashed border-slate-300"
                                )}
                            >
                                {/* Avatar or Icon */}
                                {item.workerId ? (
                                    <Avatar className="h-7 w-7 border border-black/5">
                                        <AvatarImage src={item.workerAvatar} />
                                        <AvatarFallback className="text-[10px] bg-sky-50 text-sky-600 font-semibold">{item.workerInitials || item.workerName?.[0] || "?"}</AvatarFallback>
                                    </Avatar>
                                ) : (
                                    <div className="h-7 w-7 rounded-md border border-dashed border-slate-300 flex items-center justify-center bg-white text-slate-400">
                                        <User className="h-4 w-4" />
                                    </div>
                                )}

                                <span className={cn("font-medium text-sm", item.workerId ? "text-slate-700" : "text-slate-500")}>
                                    {item.workerName || "Open Shift"}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => onRemove(item.originalIndex)}
                                    className="ml-1 h-5 w-5 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-100 hover:text-red-500 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
