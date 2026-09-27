"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import type { SchedulerShift, SchedulerWeek } from "@repo/contracts/scheduler";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { checkPerson } from "@/lib/scheduler/candidates";
import { discardWeek, fetchSchedulerWeek, weekKey } from "@/lib/scheduler/client";
import { addDays } from "@/lib/scheduler/format";
import { planMove, planRemove, type DragSource, type DropTarget, type Plan } from "@/lib/scheduler/plans";
import { useSchedulerEdits } from "@/lib/scheduler/use-scheduler-edits";
import { usePersistentState } from "@/lib/scheduler/use-persistent-state";
import { ALL_DEPARTMENTS, buildPeopleView, buildPositionsView, type ViewMode } from "@/lib/scheduler/view-model";
import { getSchedulerHref } from "@/lib/routes";
import { ConflictDialog } from "./conflict-dialog";
import { HelpDialog } from "./help-dialog";
import { PublishDialog } from "./publish-dialog";
import { QuickCreate, type QuickCreateTarget } from "./quick-create";
import { ChipGhost } from "./shift-chip";
import { ShiftDrawer } from "./shift-drawer";
import { SchedulerToolbar } from "./scheduler-toolbar";
import { CopyWeekDialog, TemplateDialog } from "./week-tools";
import { PeopleGrid, PositionsGrid, type DropHint, type GridEditing } from "./week-grid";

const isViewMode = (value: string): value is ViewMode => value === "people" || value === "positions";

const typingIn = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function Scheduler({
    orgId,
    locations,
    initialWeek,
    initialLocationId,
    initialWeekParam,
}: {
    orgId: string;
    locations: { id: string; name: string }[];
    initialWeek: SchedulerWeek;
    initialLocationId: string;
    /** The ?week= the page was opened with; null means "this week". */
    initialWeekParam: string | null;
}) {
    const [locationId, setLocationId] = useState(initialLocationId);
    const [weekParam, setWeekParam] = useState<string | null>(initialWeekParam);
    const [search, setSearch] = useState("");
    const [helpOpen, setHelpOpen] = useState(false);
    const [flashOpen, setFlashOpen] = useState(false);
    const [quickCreate, setQuickCreate] = useState<QuickCreateTarget | null>(null);
    const [lastRange, setLastRange] = useState("9-5");
    const [openShiftId, setOpenShiftId] = useState<string | null>(null);
    const [clipboard, setClipboard] = useState<DragSource | null>(null);
    const [dragging, setDragging] = useState<{ source: DragSource; shift: SchedulerShift } | null>(null);
    const [copyMode, setCopyMode] = useState(false);
    const [copyWeekOpen, setCopyWeekOpen] = useState(false);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const openRowRef = useRef<HTMLDivElement | null>(null);

    const key = weekKey(locationId, weekParam);
    const isInitial = locationId === initialLocationId && weekParam === initialWeekParam;
    const { data, error, isValidating, mutate } = useSWR(key, fetchSchedulerWeek, {
        fallbackData: isInitial ? initialWeek : undefined,
        keepPreviousData: true,
        revalidateOnFocus: true,
    });
    const week = data ?? initialWeek;

    const refresh = useCallback(() => mutate(), [mutate]);
    const edits = useSchedulerEdits(refresh);

    const [storedDepartment, setDepartment] = usePersistentState<string>(`wh.scheduler.${orgId}.department`, ALL_DEPARTMENTS);
    const department =
        storedDepartment === ALL_DEPARTMENTS || week.departments.some((d) => d.id === storedDepartment)
            ? storedDepartment
            : ALL_DEPARTMENTS;
    const [viewMode, setViewMode] = usePersistentState<ViewMode>(
        `wh.scheduler.${orgId}.view`,
        week.settings.scheduleStyle === "events" ? "positions" : "people",
        isViewMode,
    );
    const [collapsedRaw, setCollapsedRaw] = usePersistentState<string>(`wh.scheduler.${orgId}.collapsed`, "");
    const collapsed = useMemo(() => new Set(collapsedRaw.split(",").filter(Boolean)), [collapsedRaw]);

    const peopleView = useMemo(() => buildPeopleView(week, { department, search }), [week, department, search]);
    const positionRows = useMemo(() => buildPositionsView(week, { department }), [week, department]);

    // The URL follows the view so a week can be shared or reloaded, without a
    // server round trip: the native History API keeps Next's router in sync.
    const syncUrl = (next: { location: string; week: string | null }) => {
        window.history.replaceState(
            null,
            "",
            getSchedulerHref({
                location: locations.length > 1 || next.location !== locations[0]?.id ? next.location : undefined,
                week: next.week ?? undefined,
            }),
        );
    };

    const goToWeek = (next: string | null) => {
        setWeekParam(next);
        syncUrl({ location: locationId, week: next });
    };

    const changeLocation = (next: string) => {
        setLocationId(next);
        edits.reset();
        syncUrl({ location: next, week: weekParam });
    };

    const showOpenRow = () => {
        if (viewMode !== "people") setViewMode("people");
        requestAnimationFrame(() => {
            openRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            setFlashOpen(true);
            window.setTimeout(() => setFlashOpen(false), 1400);
        });
    };

    const toggleSection = (id: string) => {
        const next = new Set(collapsed);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setCollapsedRaw([...next].join(","));
    };

    const runPlan = (plan: Plan | null) => {
        if (!plan) return;
        void edits.run(plan);
    };

    // ---- Dragging -------------------------------------------------------------
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    useEffect(() => {
        if (!dragging) return;
        const track = (event: KeyboardEvent | PointerEvent) => setCopyMode(event.altKey);
        window.addEventListener("keydown", track);
        window.addEventListener("keyup", track);
        window.addEventListener("pointermove", track);
        return () => {
            window.removeEventListener("keydown", track);
            window.removeEventListener("keyup", track);
            window.removeEventListener("pointermove", track);
        };
    }, [dragging]);

    const onDragStart = (event: DragStartEvent) => {
        const payload = event.active.data.current as { source: DragSource | null; shift: SchedulerShift } | undefined;
        if (!payload?.source) return;
        setDragging({ source: payload.source, shift: payload.shift });
        setCopyMode(Boolean((event.activatorEvent as PointerEvent | undefined)?.altKey));
    };

    const onDragEnd = (event: DragEndEvent) => {
        const source = dragging?.source;
        setDragging(null);
        const target = (event.over?.data.current as { target?: DropTarget } | undefined)?.target;
        if (!source || !target) return;
        runPlan(planMove(week, source, target, { copy: copyMode }));
    };

    const hintFor = (target: DropTarget): DropHint | null => {
        if (!dragging) return null;
        const plan = planMove(week, dragging.source, target, { copy: copyMode });
        if (!plan) return null;
        if (!target.personId) return { tone: "ok", message: copyMode ? "Copy as open" : "Leave open" };
        const check = checkPerson(week, dragging.shift, target.personId, target.dayIndex);
        if (check.blocked) return { tone: "block", message: check.reasons[0] };
        if (check.reasons.length) return { tone: "warn", message: check.reasons[0] };
        return { tone: "ok" };
    };

    const editing: GridEditing = {
        chips: {
            onOpen: (shiftId) => setOpenShiftId(shiftId),
            onRemove: (source) => runPlan(planRemove(week, source)),
            onCopy: (source) => {
                setClipboard(source);
                toast("Copied. Focus a day and press v to paste.");
            },
        },
        onCreateAt: (anchor, target, role) => {
            const person = target.personId ? week.people.find((p) => p.id === target.personId) ?? null : null;
            setQuickCreate({ anchor, dayIndex: target.dayIndex, person: person ?? null, role });
        },
        onPasteAt: (target) => {
            if (!clipboard) return;
            runPlan(planMove(week, clipboard, target, { copy: true }));
        },
        hintFor,
        dragging: dragging !== null,
    };

    // ---- Keyboard ---------------------------------------------------------------
    const { undo, redo } = edits;
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (typingIn(event.target) || event.defaultPrevented) return;
            const mod = event.metaKey || event.ctrlKey;
            if (event.key.toLowerCase() === "z" && (mod || (!event.altKey && !mod))) {
                event.preventDefault();
                if (event.shiftKey) void redo();
                else void undo();
            } else if (event.key === "y" && mod) {
                event.preventDefault();
                void redo();
            } else if (event.key === "?") {
                setHelpOpen(true);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [undo, redo]);

    const discard = async () => {
        setDiscardOpen(false);
        try {
            const result = await discardWeek(week.location.id, week.weekStart);
            edits.reset();
            await mutate();
            const parts = [
                result.deletedDrafts ? `${result.deletedDrafts} ${result.deletedDrafts === 1 ? "draft" : "drafts"} deleted` : null,
                result.revertedShifts + result.revertedAssignments
                    ? `${result.revertedShifts + result.revertedAssignments} changes reverted`
                    : null,
            ].filter(Boolean);
            toast.success(parts.length ? parts.join(", ") : "Nothing to discard");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't discard");
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <SchedulerToolbar
                week={week}
                locations={locations}
                locationId={locationId}
                onLocation={changeLocation}
                onWeek={(step) => goToWeek(addDays(week.weekStart, step * 7))}
                onThisWeek={() => goToWeek(null)}
                department={department}
                onDepartment={setDepartment}
                viewMode={viewMode}
                onViewMode={setViewMode}
                onOpenCounter={showOpenRow}
                onHelp={() => setHelpOpen(true)}
                busy={(isValidating && !isInitial) || edits.busy}
                history={{
                    canUndo: edits.canUndo,
                    canRedo: edits.canRedo,
                    undoLabel: edits.nextUndoLabel,
                    onUndo: () => void edits.undo(),
                    onRedo: () => void edits.redo(),
                }}
                tools={{
                    onCopyWeek: () => setCopyWeekOpen(true),
                    onTemplate: () => setTemplateOpen(true),
                    onDiscard: () => setDiscardOpen(true),
                }}
                onPublish={() => setPublishOpen(true)}
            />

            {error ? (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                    <span>Couldn&apos;t load this week: {error.message}</span>
                    <Button size="sm" variant="outline" onClick={() => void mutate()}>
                        Try again
                    </Button>
                </div>
            ) : null}

            {week.shifts.length === 0 ? (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    Nothing scheduled yet.
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => setCopyWeekOpen(true)}>
                        Copy last week
                    </button>
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => setTemplateOpen(true)}>
                        Use a template
                    </button>
                    <span>or click any day to add a shift.</span>
                </p>
            ) : null}

            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
                <div
                    aria-busy={isValidating || edits.busy}
                    className={cn(
                        "max-h-[calc(100vh-12rem)] min-h-[360px] overflow-auto overscroll-contain rounded-xl border bg-card shadow-sm transition-opacity",
                        isValidating && !data && "opacity-60",
                    )}
                >
                    {viewMode === "people" ? (
                        <PeopleGrid
                            week={week}
                            view={peopleView}
                            search={search}
                            onSearch={setSearch}
                            collapsed={collapsed}
                            onToggleSection={toggleSection}
                            flashOpenRow={flashOpen}
                            openRowRef={openRowRef}
                            editing={editing}
                        />
                    ) : (
                        <PositionsGrid week={week} rows={positionRows} editing={editing} />
                    )}
                </div>
                <DragOverlay dropAnimation={null}>{dragging ? <ChipGhost shift={dragging.shift} copy={copyMode} /> : null}</DragOverlay>
            </DndContext>

            <p className="text-xs text-muted-foreground">
                Times are {week.location.name}&apos;s local time ({week.location.timezone.replace(/_/g, " ")}). Changes stay drafts until you
                publish. Press ? for shortcuts.
            </p>

            <QuickCreate
                week={week}
                target={quickCreate}
                lastRange={lastRange}
                onClose={() => setQuickCreate(null)}
                onCreate={(plan, typed) => {
                    setQuickCreate(null);
                    setLastRange(typed);
                    runPlan(plan);
                }}
            />
            <ShiftDrawer week={week} shiftId={openShiftId} onClose={() => setOpenShiftId(null)} run={(plan) => edits.run(plan)} />
            <ConflictDialog conflict={edits.conflict} />
            <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
            <PublishDialog
                week={week}
                open={publishOpen}
                onOpenChange={setPublishOpen}
                onPublished={async () => {
                    // Undo can't reach past what staff have already been told.
                    edits.reset();
                    await mutate();
                }}
                onReview={(shiftId) => setOpenShiftId(shiftId)}
            />
            <CopyWeekDialog week={week} open={copyWeekOpen} onOpenChange={setCopyWeekOpen} run={(plan, options) => edits.run(plan, options)} />
            <TemplateDialog week={week} open={templateOpen} onOpenChange={setTemplateOpen} run={(plan) => edits.run(plan)} />
            <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard unpublished changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deletes this week&apos;s drafts at {week.location.name} and puts published shifts back the way staff see them.
                            Other weeks and locations aren&apos;t touched. This can&apos;t be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep them</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void discard()}>Discard</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
