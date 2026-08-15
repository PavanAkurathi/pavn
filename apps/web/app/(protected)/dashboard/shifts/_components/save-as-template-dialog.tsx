"use client";

import * as React from "react";
import { LayoutTemplate } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { saveAsTemplateAction } from "../_actions/templates";

interface SaveAsTemplateDialogProps {
    shiftId: string;
    /** Seeds the name field — usually the location, which is how people refer to these. */
    suggestedName: string;
}

/**
 * Keep this shift's shape for next time.
 *
 * Saves the roles, headcount, hours and place of the whole block — and
 * deliberately not the people on it, so a template never quietly schedules
 * someone who left months ago.
 */
export function SaveAsTemplateDialog({ shiftId, suggestedName }: SaveAsTemplateDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState(suggestedName);
    const [isSaving, setIsSaving] = React.useState(false);

    // Seeded when the dialog opens rather than synced by an effect — the name is
    // a starting point the manager then edits, not a mirror of the prop.
    const openDialog = () => {
        setName(suggestedName);
        setOpen(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await saveAsTemplateAction(shiftId, name);
            if ("error" in result) {
                toast.error(result.error);
                return;
            }
            toast.success(`Saved "${result.name}". Reuse it from Use a template.`);
            setOpen(false);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <Button variant="outline" onClick={openDialog}>
                <LayoutTemplate data-icon="inline-start" />
                Save as template
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Save as template</DialogTitle>
                        <DialogDescription>
                            Keeps the roles, headcount, hours and location. Not the people — you pick
                            those each time you use it.
                        </DialogDescription>
                    </DialogHeader>

                    <Input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="e.g. Saturday Night Crew"
                        maxLength={80}
                        autoFocus
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && name.trim() && !isSaving) void handleSave();
                        }}
                    />

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
                            {isSaving ? "Saving…" : "Save template"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
