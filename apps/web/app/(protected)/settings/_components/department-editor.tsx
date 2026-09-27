"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import type { SchedulingDepartment } from "@repo/contracts/scheduler";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@repo/ui/components/ui/alert-dialog";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { addDepartment, editDepartment, removeDepartment } from "@/actions/scheduling";

const splitRoles = (text: string) =>
    text
        .split(/[,;\n]+/)
        .map((role) => role.trim())
        .filter(Boolean);

function DepartmentFields({
    idPrefix,
    name,
    roles,
    onName,
    onRoles,
    disabled,
}: {
    idPrefix: string;
    name: string;
    roles: string;
    onName: (value: string) => void;
    onRoles: (value: string) => void;
    disabled?: boolean;
}) {
    return (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <Field>
                <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
                <Input
                    id={`${idPrefix}-name`}
                    value={name}
                    maxLength={60}
                    placeholder="Kitchen"
                    disabled={disabled}
                    onChange={(event) => onName(event.target.value)}
                />
            </Field>
            <Field>
                <FieldLabel htmlFor={`${idPrefix}-roles`}>Roles</FieldLabel>
                <Input
                    id={`${idPrefix}-roles`}
                    value={roles}
                    placeholder="Line cook, Prep cook, Dishwasher"
                    disabled={disabled}
                    onChange={(event) => onRoles(event.target.value)}
                />
                <FieldDescription>Separate with commas. Leave empty to catch everyone else.</FieldDescription>
            </Field>
        </div>
    );
}

export function DepartmentEditor({
    departments,
    canManage,
}: {
    departments: SchedulingDepartment[];
    canManage: boolean;
}) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editRoles, setEditRoles] = useState("");
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [newRoles, setNewRoles] = useState("");

    const run = async (key: string, action: () => Promise<{ error?: string }>, done: string) => {
        setBusy(key);
        try {
            const result = await action();
            if (result.error) {
                toast.error(result.error);
                return false;
            }
            toast.success(done);
            router.refresh();
            return true;
        } finally {
            setBusy(null);
        }
    };

    const startEdit = (d: SchedulingDepartment) => {
        setEditingId(d.id);
        setEditName(d.name);
        setEditRoles(d.roles.join(", "));
    };

    const move = async (index: number, by: -1 | 1) => {
        const reordered = [...departments];
        const [moved] = reordered.splice(index, 1);
        reordered.splice(index + by, 0, moved!);
        await run(
            `move-${moved!.id}`,
            async () => {
                // Renumber everything whose position changed, so gaps and ties from
                // earlier edits disappear too.
                for (const [position, d] of reordered.entries()) {
                    if (d.sortOrder === position) continue;
                    const result = await editDepartment(d.id, { sortOrder: position });
                    if (result.error) return result;
                }
                return {};
            },
            "Order saved.",
        );
    };

    const disabled = busy !== null;

    return (
        <div className="flex flex-col gap-3">
            {departments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No departments yet. Until you add one, everyone shows up together as one Team.
                </p>
            ) : (
                <ul className="flex flex-col divide-y rounded-xl border">
                    {departments.map((d, index) =>
                        editingId === d.id ? (
                            <li key={d.id} className="flex flex-col gap-3 p-4">
                                <DepartmentFields
                                    idPrefix={`dept-${d.id}`}
                                    name={editName}
                                    roles={editRoles}
                                    onName={setEditName}
                                    onRoles={setEditRoles}
                                    disabled={disabled}
                                />
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="ghost" disabled={disabled} onClick={() => setEditingId(null)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={disabled || !editName.trim()}
                                        onClick={async () => {
                                            const ok = await run(
                                                `edit-${d.id}`,
                                                () => editDepartment(d.id, { name: editName.trim(), roles: splitRoles(editRoles) }),
                                                "Department saved.",
                                            );
                                            if (ok) setEditingId(null);
                                        }}
                                    >
                                        {busy === `edit-${d.id}` ? <Spinner data-icon="inline-start" /> : null}
                                        Save
                                    </Button>
                                </div>
                            </li>
                        ) : (
                            <li key={d.id} className="flex flex-wrap items-center gap-3 p-4">
                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                    <p className="text-sm font-medium text-foreground">{d.name}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {d.roles.length ? (
                                            d.roles.map((role) => (
                                                <Badge key={role} variant="secondary" className="font-normal">
                                                    {role}
                                                </Badge>
                                            ))
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Everyone not in another department</span>
                                        )}
                                    </div>
                                </div>
                                {canManage ? (
                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Move ${d.name} up`}
                                            disabled={disabled || index === 0}
                                            onClick={() => void move(index, -1)}
                                        >
                                            <ArrowUp />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Move ${d.name} down`}
                                            disabled={disabled || index === departments.length - 1}
                                            onClick={() => void move(index, 1)}
                                        >
                                            <ArrowDown />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Edit ${d.name}`}
                                            disabled={disabled}
                                            onClick={() => startEdit(d)}
                                        >
                                            <Pencil />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Delete ${d.name}`}
                                                    disabled={disabled}
                                                >
                                                    <Trash2 />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete {d.name}?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Nobody is removed. People in it move to whichever department matches
                                                        their roles, or to none.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() =>
                                                            void run(`delete-${d.id}`, () => removeDepartment(d.id), `${d.name} deleted.`)
                                                        }
                                                    >
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                ) : null}
                            </li>
                        ),
                    )}
                </ul>
            )}

            {canManage ? (
                adding ? (
                    <div className="flex flex-col gap-3 rounded-xl border p-4">
                        <DepartmentFields
                            idPrefix="dept-new"
                            name={newName}
                            roles={newRoles}
                            onName={setNewName}
                            onRoles={setNewRoles}
                            disabled={disabled}
                        />
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" disabled={disabled} onClick={() => setAdding(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                disabled={disabled || !newName.trim()}
                                onClick={async () => {
                                    const ok = await run(
                                        "add",
                                        () => addDepartment({ name: newName.trim(), roles: splitRoles(newRoles) }),
                                        `${newName.trim()} added.`,
                                    );
                                    if (ok) {
                                        setAdding(false);
                                        setNewName("");
                                        setNewRoles("");
                                    }
                                }}
                            >
                                {busy === "add" ? <Spinner data-icon="inline-start" /> : null}
                                Add department
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button type="button" variant="outline" className="w-fit" disabled={disabled} onClick={() => setAdding(true)}>
                        <Plus data-icon="inline-start" />
                        Add department
                    </Button>
                )
            ) : null}
        </div>
    );
}
