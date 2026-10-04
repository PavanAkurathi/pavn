"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { AddShiftPrefill } from "@/lib/scheduler/add-shift";
import { checkPerson } from "@/lib/scheduler/candidates";
import { discardWeek } from "@/lib/scheduler/client";
import { addDays, shortDate, weekRangeLabel } from "@/lib/scheduler/format";
import { planMove, planRemove, staying, type DragSource, type DropTarget, type Plan } from "@/lib/scheduler/plans";
import { usePersistentState } from "@/lib/scheduler/use-persistent-state";
import { useSchedulerEdits } from "@/lib/scheduler/use-scheduler-edits";
import { useWorkspace } from "@/lib/scheduler/use-workspace";
import { ALL_DEPARTMENTS, buildPeopleView } from "@/lib/scheduler/view-model";
import { ALL_SITES, publishScope, unfilledByDay, type Site } from "@/lib/scheduler/workspace";
import { localToday } from "@/lib/scheduler/zoned";
import { weekStartOf } from "@/lib/shifts/draft-groups";
import { getSchedulerHref } from "@/lib/routes";
import { AddShiftPanel } from "./add-shift-panel";
import { ConflictDialog } from "./conflict-dialog";
import { DayPlan, type DayFilter } from "./day-plan";
import { EventDrawer, type EventEditTarget } from "./event-drawer";
import { HelpDialog } from "./help-dialog";
import { ReviewPublish } from "./review-publish";
import { ScheduleHeader, Segmented, type ScheduleView } from "./schedule-header";
import { ChipGhost, type Density } from "./shift-chip";
import { ShiftDrawer } from "./shift-drawer";
import { CopyWeekDialog, TemplateDialog } from "./week-tools";
import { PeopleGrid, type DropHint, type GridEditing } from "./week-grid";

const isView = (value: string): value is ScheduleView => value === "week" || value === "day";
const isDensityChoice = (value: string): value is Density | "auto" => value === "comfortable" || value === "compact" || value === "auto";
/** From this many people on, entries default to one line each. */
const BIG_TEAM = 50;

const typingIn = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function ScheduleWorkspace({
    orgId,
    sites,
    initialWeeks,
    initialDate,
    initialView,
    initialSite,
}: {
    orgId: string;
    sites: Site[];
    /** Every site's week, for the week the page opened on. */
    initialWeeks: SchedulerWeek[];
    initialDate: string;
    /** From the link, if it carried one. Otherwise the remembered view. */
    initialView: ScheduleView | null;
    initialSite: string | null;
}) {
    const [date, setDate] = useState(initialDate);
    const [search, setSearch] = useState("");
    const [helpOpen, setHelpOpen] = useState(false);
    const [addPrefill, setAddPrefill] = useState<AddShiftPrefill | null>(null);
    const [openShiftId, setOpenShiftId] = useState<string | null>(null);
    const [clipboard, setClipboard] = useState<DragSource | null>(null);
    const [dragging, setDragging] = useState<{ source: DragSource; shift: SchedulerShift } | null>(null);
    const [copyMode, setCopyMode] = useState(false);
    const [copyWeekOpen, setCopyWeekOpen] = useState(false);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [eventTarget, setEventTarget] = useState<EventEditTarget | null>(null);
    const [dayFilter, setDayFilter] = useState<DayFilter>("all");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // ---- What is remembered: the view and the site -------------------------------
    const defaultScope = sites.length > 1 ? ALL_SITES : sites[0]!.id;
    const isScope = useCallback((value: string): value is string => value === ALL_SITES || sites.some((s) => s.id === value), [sites]);
    const [view, setView] = usePersistentState<ScheduleView>(`wh.scheduler.${orgId}.workspace.view`, "week", isView);
    const [storedScope, setScope] = usePersistentState<string>(`wh.scheduler.${orgId}.workspace.site`, defaultScope, isScope);
    const scope = sites.length === 1 ? sites[0]!.id : storedScope;

    // A link that names a view or a site wins, and becomes what is remembered.
    const applied = useRef(false);
    useEffect(() => {
        if (applied.current) return;
        applied.current = true;
        if (initialView) setView(initialView);
        if (initialSite && isScope(initialSite)) setScope(initialSite);
    }, [initialView, initialSite, isScope, setView, setScope]);

    // ---- The data: every site's week, shown for the site in scope --------------
    const weekStartsOn = initialWeeks[0]!.weekStartsOn;
    const weekStart = weekStartOf(date, weekStartsOn);
    const { weeks, workspace: ws, error, isValidating, mutate } = useWorkspace({
        sites,
        scope,
        weekStart,
        initialWeeks,
        initialWeekStart: initialWeeks[0]!.weekStart,
    });
    const week = ws.week;
    const today = localToday(week.location.timezone);
    const siteScoped = ws.sites.length === 1;
    const weekIsEmpty = week.shifts.length === 0;
    const singleSiteWeek = siteScoped ? ws.weeks[0]! : null;

    const refresh = useCallback(() => mutate(), [mutate]);
    const edits = useSchedulerEdits(refresh);

    const [storedDepartment, setDepartment] = usePersistentState<string>(`wh.scheduler.${orgId}.department`, ALL_DEPARTMENTS);
    const department = storedDepartment === ALL_DEPARTMENTS || week.departments.some((d) => d.id === storedDepartment) ? storedDepartment : ALL_DEPARTMENTS;
    const [storedDensity, setDensity] = usePersistentState<Density | "auto">(`wh.scheduler.${orgId}.density`, "auto", isDensityChoice);
    const density: Density = storedDensity === "auto" ? (week.people.length >= BIG_TEAM ? "compact" : "comfortable") : storedDensity;
    const [collapsedRaw, setCollapsedRaw] = usePersistentState<string>(`wh.scheduler.${orgId}.collapsed`, "");
    const collapsed = useMemo(() => new Set(collapsedRaw.split(",").filter(Boolean)), [collapsedRaw]);

    const peopleView = useMemo(() => buildPeopleView(week, { department, search }), [week, department, search]);
    const unfilled = useMemo(() => unfilledByDay(ws), [ws]);

    // ---- What publishing would include ----------------------------------------
    const inScopeIds = ws.sites.map((s) => s.id);
    const scopeOfPublish = publishScope(weeks, inScopeIds);
    const pending = scopeOfPublish.included.reduce((sum, s) => sum + s.pending, 0);
    const elsewhere = scopeOfPublish.excluded.map((s) => ({ name: s.site.name, count: s.pending }));

    // ---- Where we are, in the address bar ------------------------------------
    useEffect(() => {
        window.history.replaceState(
            null,
            "",
            getSchedulerHref({
                view: view === "day" ? "day" : undefined,
                date: date === today ? undefined : date,
                site: scope === defaultScope ? undefined : scope,
            }),
        );
    }, [view, date, scope, today, defaultScope]);

    // ---- Moving around ---------------------------------------------------------
    const step = (direction: -1 | 1) => setDate(view === "week" ? addDays(weekStart, direction * 7) : addDays(date, direction));
    const openDay = (localDate: string, filter: DayFilter = "all") => {
        setDate(localDate);
        setDayFilter(filter);
        setView("day");
    };
    const toggleExpanded = (key: string) =>
        setExpanded((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    const toggleSection = (id: string) => {
        const next = new Set(collapsed);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setCollapsedRaw([...next].join(","));
    };
    const changeScope = (next: string) => {
        setScope(next);
        edits.reset();
    };

    const dateLabel = view === "week" ? weekRangeLabel(week.days[0]!.localDate, week.days[6]!.localDate, today) : shortDate(date);
    const onThisPeriod = view === "week" ? week.days.some((d) => d.localDate === today) : date === today;

    // ---- Adding ----------------------------------------------------------------
    const defaultAddDate = view === "day" ? date : (week.days.find((d) => d.localDate === today)?.localDate ?? week.days[0]!.localDate);
    const addShift = (prefill: AddShiftPrefill = {}) =>
        setAddPrefill({ localDate: defaultAddDate, siteId: scope !== ALL_SITES ? scope : undefined, ...prefill });

    const runPlan = (plan: Plan | null) => {
        if (!plan) return;
        void edits.run(plan);
    };

    const removePerson = (shift: SchedulerShift, personId: string) => {
        const name = week.people.find((p) => p.id === personId)?.name.split(" ")[0] ?? "someone";
        runPlan({
            changes: [{ op: "assign", shiftId: shift.id, assignees: staying(shift).filter((r) => r.personId !== personId) }],
            label: `Took ${name} off ${shift.role}, ${shortDate(shift.localDate)}`,
        });
    };

    // ---- Dragging --------------------------------------------------------------
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
        onAddAt: (target) => {
            const person = target.personId ? (week.people.find((p) => p.id === target.personId) ?? null) : null;
            addShift({ localDate: week.days[target.dayIndex]!.localDate, person, role: person?.primaryRole ?? undefined });
        },
        onPasteAt: (target) => {
            if (!clipboard) return;
            runPlan(planMove(week, clipboard, target, { copy: true }));
        },
        hintFor,
        dragging: dragging !== null,
        density,
        showSite: !siteScoped,
        siteNames: new Map(sites.map((s) => [s.id, s.name])),
        eventNames: new Map(ws.events.map((e) => [e.id, e.name])),
    };

    const addEvent = () => {
        const index = week.days.findIndex((d) => d.localDate === (view === "day" ? date : today));
        setEventTarget({ mode: "new", dayIndex: Math.max(0, index) });
    };

    // ---- Keyboard --------------------------------------------------------------
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
            const results = await Promise.all(
                scopeOfPublish.included.map((s) => discardWeek(s.site.id, weekStart)),
            );
            edits.reset();
            await mutate();
            const drafts = results.reduce((sum, r) => sum + r.deletedDrafts, 0);
            const reverted = results.reduce((sum, r) => sum + r.revertedShifts + r.revertedAssignments, 0);
            const parts = [drafts ? `${drafts} ${drafts === 1 ? "draft" : "drafts"} deleted` : null, reverted ? `${reverted} changes reverted` : null].filter(Boolean);
            toast.success(parts.length ? parts.join(", ") : "Nothing to discard");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't discard");
        }
    };

    const otherSitesShifts = weeks.filter((w) => !inScopeIds.includes(w.location.id)).reduce((sum, w) => sum + w.shifts.length, 0);

    return (
        <div className="flex flex-col gap-4">
            <ScheduleHeader
                view={view}
                onView={setView}
                dateLabel={dateLabel}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
                onToday={() => setDate(today)}
                onThisPeriod={onThisPeriod}
                sites={sites}
                scope={scope}
                onScope={changeScope}
                onAddShift={() => addShift()}
                pending={pending}
                elsewhere={elsewhere}
                onReview={() => setReviewOpen(true)}
                reviewBusy={edits.busy}
                hasShifts={!weekIsEmpty}
                busy={(isValidating && !weeks.length) || edits.busy}
                history={{
                    canUndo: edits.canUndo,
                    canRedo: edits.canRedo,
                    undoLabel: edits.nextUndoLabel,
                    onUndo: () => void edits.undo(),
                    onRedo: () => void edits.redo(),
                }}
                tools={{
                    singleSite: siteScoped,
                    onCopyWeek: () => setCopyWeekOpen(true),
                    onTemplate: () => setTemplateOpen(true),
                    onAddEvent: addEvent,
                    onDiscard: () => setDiscardOpen(true),
                }}
                density={density}
                onDensity={setDensity}
                showDensity={view === "week"}
                onHelp={() => setHelpOpen(true)}
            />

            {error ? (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                    <span>Couldn&apos;t load this week: {error.message}</span>
                    <Button size="sm" variant="outline" onClick={() => void mutate()}>
                        Try again
                    </Button>
                </div>
            ) : null}

            {view === "week" && week.departments.length > 1 && !weekIsEmpty ? (
                <Segmented
                    label="Department"
                    value={department}
                    onChange={setDepartment}
                    options={[[ALL_DEPARTMENTS, "All"], ...week.departments.map((d) => [d.id, d.name] as [string, string])]}
                />
            ) : null}

            {view === "week" ? (
                weekIsEmpty ? (
                    <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
                        <p className="text-[15px] font-bold">{siteScoped && otherSitesShifts > 0 ? `No shifts at ${ws.sites[0]!.name} this week` : "Nothing scheduled this week"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {siteScoped && otherSitesShifts > 0
                                ? `Other sites have ${otherSitesShifts} ${otherSitesShifts === 1 ? "shift" : "shifts"}.`
                                : `${weekRangeLabel(week.days[0]!.localDate, week.days[6]!.localDate, today)}${siteScoped ? ` · ${ws.sites[0]!.name}` : ""}`}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            <Button variant="outline" onClick={() => addShift()}>
                                Add shift
                            </Button>
                            {siteScoped && otherSitesShifts > 0 ? (
                                <Button variant="ghost" onClick={() => changeScope(ALL_SITES)}>
                                    Show all sites
                                </Button>
                            ) : null}
                            {siteScoped ? (
                                <>
                                    <Button variant="ghost" onClick={() => setCopyWeekOpen(true)}>
                                        Copy last week
                                    </Button>
                                    <Button variant="ghost" onClick={() => setTemplateOpen(true)}>
                                        Use a template
                                    </Button>
                                </>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
                        <div className="overflow-hidden rounded-card border bg-card shadow-sm">
                            <div aria-busy={isValidating || edits.busy} className="max-h-[calc(100vh-14rem)] min-h-[360px] overflow-auto overscroll-contain bg-card transition-opacity">
                                <PeopleGrid
                                    week={week}
                                    view={peopleView}
                                    unfilled={unfilled}
                                    search={search}
                                    onSearch={setSearch}
                                    collapsed={collapsed}
                                    onToggleSection={toggleSection}
                                    onOpenDay={(index) => openDay(week.days[index]!.localDate)}
                                    onNeedsPeople={(index) => openDay(week.days[index]!.localDate, "needs")}
                                    editing={editing}
                                />
                            </div>
                        </div>
                        <DragOverlay dropAnimation={null}>{dragging ? <ChipGhost shift={dragging.shift} copy={copyMode} /> : null}</DragOverlay>
                    </DndContext>
                )
            ) : (
                <DayPlan
                    ws={ws}
                    date={date}
                    filter={dayFilter}
                    onFilter={setDayFilter}
                    onDate={setDate}
                    expanded={expanded}
                    onToggle={toggleExpanded}
                    onOpenShift={setOpenShiftId}
                    onAddShift={addShift}
                    onRemovePerson={removePerson}
                    onEditEvent={(eventId) => setEventTarget({ mode: "edit", eventId })}
                    siteScoped={siteScoped}
                />
            )}

            <p className="text-xs text-muted-foreground">
                {siteScoped
                    ? `Times are ${ws.sites[0]!.name}'s local time (${week.location.timezone.replace(/_/g, " ")}). `
                    : "Times are each site's own local time. "}
                Changes stay drafts until you publish.{view === "week" ? " Press ? for shortcuts." : ""}
            </p>

            <AddShiftPanel
                ws={ws}
                sites={sites}
                scope={scope}
                prefill={addPrefill}
                onClose={() => setAddPrefill(null)}
                run={(plan) => edits.run(plan)}
                onSaved={(localDate) => {
                    if (weekStartOf(localDate, weekStartsOn) !== weekStart) setDate(localDate);
                }}
            />
            <ShiftDrawer
                week={week}
                shiftId={openShiftId}
                onClose={() => setOpenShiftId(null)}
                run={(plan) => edits.run(plan)}
                onOpenEvent={(eventId) => {
                    setOpenShiftId(null);
                    setEventTarget({ mode: "edit", eventId });
                }}
            />
            <EventDrawer
                week={week}
                target={eventTarget}
                onClose={() => setEventTarget(null)}
                run={(plan) => edits.run(plan)}
                onStaff={(shiftId) => {
                    setEventTarget(null);
                    setOpenShiftId(shiftId);
                }}
            />
            <ConflictDialog conflict={edits.conflict} />
            <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
            <ReviewPublish
                weeks={ws.weeks}
                excluded={scopeOfPublish.excluded}
                open={reviewOpen}
                onOpenChange={setReviewOpen}
                onPublished={async () => {
                    // Undo can't reach past what staff have already been told.
                    edits.reset();
                    await mutate();
                }}
                onReview={(shiftId) => setOpenShiftId(shiftId)}
            />
            {singleSiteWeek ? (
                <>
                    <CopyWeekDialog week={singleSiteWeek} open={copyWeekOpen} onOpenChange={setCopyWeekOpen} run={(plan, options) => edits.run(plan, options)} />
                    <TemplateDialog week={singleSiteWeek} open={templateOpen} onOpenChange={setTemplateOpen} run={(plan) => edits.run(plan)} />
                </>
            ) : null}
            <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard unpublished changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deletes this week&apos;s drafts at {ws.sites.map((s) => s.name).join(", ")} and puts published shifts back the way staff see them. Other weeks
                            {siteScoped && sites.length > 1 ? " and sites" : ""} aren&apos;t touched. This can&apos;t be undone.
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

