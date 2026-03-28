import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
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
        <div className="flex flex-col gap-4">
            {(Object.entries(grouped) as [string, any[]][]).map(([role, items]) => (
                <CollapsibleRoleGroup key={role} role={role} items={items} onRemove={onRemove} />
            ))}
        </div>
    );
}

function CollapsibleRoleGroup({ role, items, onRemove }: { role: string, items: any[], onRemove: (index: number) => void }) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-2 group w-full hover:opacity-80 transition-opacity">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                        {role}
                        <Badge variant="secondary" className="h-auto px-1.5 py-0.5 text-[10px] font-bold">
                            {items.length}
                        </Badge>
                    </h4>
                    <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", isOpen ? "" : "-rotate-90")} />
                </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="animate-collapsible-down">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((item: any) => (
                        <div
                            key={item.id}
                            className={cn(
                                "group relative flex select-none items-center gap-3 rounded-xl border p-3 transition-all",
                                item.workerId
                                    ? "bg-muted/40 text-foreground hover:bg-muted/70"
                                    : "border-dashed border-muted-foreground/30 bg-background"
                            )}
                        >
                            {item.workerId ? (
                                <Avatar className="size-9 border border-background shadow-sm">
                                    <AvatarImage src={item.workerAvatar} />
                                    <AvatarFallback className="border border-border bg-muted text-xs font-semibold text-foreground">
                                        {item.workerInitials || item.workerName?.[0] || "?"}
                                    </AvatarFallback>
                                </Avatar>
                            ) : (
                                <div className="flex size-9 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-background text-muted-foreground">
                                    <User className="h-4 w-4" />
                                </div>
                            )}

                            <div className="flex flex-col min-w-0">
                                <span className={cn("truncate text-sm font-semibold", item.workerId ? "text-foreground" : "text-muted-foreground")}>
                                    {item.workerName || "Open Shift"}
                                </span>
                                {item.workerId && <span className="truncate text-[10px] font-medium text-muted-foreground">{role}</span>}
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onRemove(item.originalIndex)}
                                className="absolute right-2 top-2 size-5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 focus:opacity-100 hover:text-destructive"
                            >
                                <X size={12} />
                            </Button>
                        </div>
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
