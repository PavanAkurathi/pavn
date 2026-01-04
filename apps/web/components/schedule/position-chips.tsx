import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { X, User, ChevronDown } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { useState } from "react";

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
                <CollapsibleRoleGroup key={role} role={role} items={items} onRemove={onRemove} />
            ))}
        </div>
    );
}

function CollapsibleRoleGroup({ role, items, onRemove }: { role: string, items: any[], onRemove: (index: number) => void }) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
            <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-2 group w-full hover:opacity-80 transition-opacity">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                        {role}
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-600 border font-bold">
                            {items.length}
                        </span>
                    </h4>
                    <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", isOpen ? "" : "-rotate-90")} />
                </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="space-y-2 animate-collapsible-down">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((item: any) => (
                        <div
                            key={item.id}
                            className={cn(
                                "relative flex items-center gap-3 p-3 rounded-xl transition-all group select-none",
                                item.workerId
                                    ? "bg-zinc-50 hover:bg-zinc-100 text-zinc-900 border border-zinc-200"
                                    : "bg-white border border-dashed border-zinc-300"
                            )}
                        >
                            {/* Avatar or Icon */}
                            {item.workerId ? (
                                <Avatar className="h-9 w-9 border border-white shadow-sm">
                                    <AvatarImage src={item.workerAvatar} />
                                    <AvatarFallback className="text-xs bg-zinc-100 text-zinc-700 font-semibold border border-zinc-200">
                                        {item.workerInitials || item.workerName?.[0] || "?"}
                                    </AvatarFallback>
                                </Avatar>
                            ) : (
                                <div className="h-9 w-9 rounded-full border border-dashed border-slate-300 flex items-center justify-center bg-white text-slate-400">
                                    <User className="h-4 w-4" />
                                </div>
                            )}

                            <div className="flex flex-col min-w-0">
                                <span className={cn("font-semibold text-sm truncate", item.workerId ? "text-slate-900" : "text-slate-500")}>
                                    {item.workerName || "Open Shift"}
                                </span>
                                {item.workerId && <span className="text-[10px] text-slate-500 font-medium truncate">{role}</span>}
                            </div>

                            <button
                                type="button"
                                onClick={() => onRemove(item.originalIndex)}
                                className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center text-slate-400 hover:bg-white hover:text-red-500 hover:shadow-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
