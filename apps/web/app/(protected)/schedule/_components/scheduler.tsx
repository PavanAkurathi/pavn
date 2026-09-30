"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { SchedulerWeek } from "@repo/contracts/scheduler";
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
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { buildDay, publishableChanges, weekCoverage, weekIssues } from "@/lib/scheduler/day-model";
import { discardWeek, fetchSchedulerWeek, weekKey } from "@/lib/scheduler/client";
import { addDays } from "@/lib/scheduler/format";
import { planRemove, type Plan } from "@/lib/scheduler/plans";
import { useSchedulerEdits } from "@/lib/scheduler/use-scheduler-edits";
import { usePersistentState } from "@/lib/scheduler/use-persistent-state";
import { ALL_DEPARTMENTS, buildPeopleView, buildPositionsView, type ViewMode } from "@/lib/scheduler/view-model";
import { getSchedulerHref } from "@/lib/routes";
import { AddShiftSheet, type AddShiftTarget } from "./add-shift-sheet";
import { ConflictDialog } from "./conflict-dialog";
import { DayPanel } from "./day-panel";
import { EventDrawer, type EventEditTarget } from "./event-drawer";
import { HelpDialog } from "./help-dialog";
import { PublishBar } from "./publish-bar";
import { PublishDialog } from "./publish-dialog";
import { RequestsPanel } from "./requests-panel";
import { ScheduleHeader, type Layout } from "./schedule-header";
import { ShiftDrawer } from "./shift-drawer";
import { SuggestSheet } from "./suggest-sheet";
import { CopyWeekDialog, TemplateDialog } from "./week-tools";
import { PeopleGrid, PositionsGrid, type GridEditing } from "./week-grid";
import { WeekStrip } from "./week-strip";
import { WeekSummary } from "./week-summary";

const isViewMode = (value: string): value is ViewMode => value === "people" || value === "positions";
const isLayout = (value: string): value is Layout => value === "day" || value === "week";

const typingIn = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Today's day of the week if it's in this week, else the first day. */
function defaultDay(week: SchedulerWeek, dayParam: string | null): number {
    const asked = dayParam ? week.days.findIndex((d) => d.localDate === dayParam) : -1;
    if (asked >= 0) return asked;
    const today = week.days.findIndex((d) => d.isToday);
    return today >= 0 ? today : 0;
}

export function Scheduler({
    orgId,
    locations,
    initialWeek,
    initialLocationId,
    initialWeekParam,
    initialDayParam,
}: {
    orgId: string;
    locations: { id: string; name: string }[];
    initialWeek: SchedulerWeek;
    initialLocationId: string;
    /** The ?week= the page was opened with; null means "this week". */
    initialWeekParam: string | null;
    /** The ?day= the page was opened with; null means today, or the first day. */
    initialDayParam: string | null;
}) {
    const [locationId, setLocationId] = useState(initialLocationId);
    const [weekParam, setWeekParam] = useState<string | null>(initialWeekParam);
    // "today" waits for the week to arrive to know which day of it that is.
    const [selection, setSelection] = useState<number | "today">(() => defaultDay(initialWeek, initialDayParam));
    const [search, setSearch] = useState("");
    const [helpOpen, setHelpOpen] = useState(false);
    const [addTarget, setAddTarget] = useState<AddShiftTarget | null>(null);
    const [lastRange, setLastRange] = useState("9-5");
    const [openShiftId, setOpenShiftId] = useState<string | null>(null);
    const [suggestShiftId, setSuggestShiftId] = useState<string | null>(null);
    const [copyWeekOpen, setCopyWeekOpen] = useState(false);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const [eventTarget, setEventTarget] = useState<EventEditTarget | null>(null);
    const [requestsOpen, setRequestsOpen] = useState(false);

    const key = weekKey(locationId, weekParam);
    const isInitial = locationId === initialLocationId && weekParam === initialWeekParam;
    const { data, error, isValidating, mutate } = useSWR(key, fetchSchedulerWeek, {
        fallbackData: isInitial ? initialWeek : undefined,
        keepPreviousData: true,
        revalidateOnFocus: true,
    });
    const week = data ?? initialWeek;
    const selectedDay = selection === "today" ? Math.max(0, week.days.findIndex((d) => d.isToday)) : selection;

    const refresh = useCallback(() => mutate(), [mutate]);
    const edits = useSchedulerEdits(refresh);

    const [storedDepartment, setDepartment] = usePersistentState<string>(`wh.scheduler.${orgId}.department`, ALL_DEPARTMENTS);
    const department =
        storedDepartment === ALL_DEPARTMENTS || week.departments.some((d) => d.id === storedDepartment)
            ? storedDepartment
            : ALL_DEPARTMENTS;
    // Managers who schedule around bookings get the table by role; everyone else by person.
    const [tableMode, setTableMode] = usePersistentState<ViewMode>(
        `wh.scheduler.${orgId}.view`,
        week.settings.scheduleStyle === "events" ? "positions" : "people",
        isViewMode,
    );
    const [layout, setLayout] = usePersistentState<Layout>(`wh.scheduler.${orgId}.layout`, "day", isLayout);
    const [collapsedRaw, setCollapsedRaw] = usePersistentState<string>(`wh.scheduler.${orgId}.collapsed`, "");
    const collapsed = useMemo(() => new Set(collapsedRaw.split(",").filter(Boolean)), [collapsedRaw]);

    const filter = useMemo(() => ({ department, search }), [department, search]);
    const coverage = useMemo(() => weekCoverage(week, { department }), [week, department]);
    const issues = useMemo(() => weekIssues(week, { department }), [week, department]);
    const dayModel = useMemo(() => buildDay(week, selectedDay, filter), [week, selectedDay, filter]);
    // Read the clock when the week changes, not on every render.
    const publishable = useMemo(() => publishableChanges(week), [week]);
    const openSpots = useMemo(() => coverage.reduce((sum, c) => sum + c.open, 0), [coverage]);
    const peopleView = useMemo(() => buildPeopleView(week, { department, search }), [week, department, search]);
    const positionRows = useMemo(() => buildPositionsView(week, { department }), [week, department]);

    // The URL follows the view so a day can be shared or reloaded, without a
    // server round trip: the native History API keeps Next's router in sync.
    const syncUrl = (next: { location: string; week: string | null; day: string | null }) => {
        window.history.replaceState(
            null,
            "",
            getSchedulerHref({
                location: locations.length > 1 || next.location !== locations[0]?.id ? next.location : undefined,
                week: next.week ?? undefined,
                day: next.day ?? undefined,
            }),
        );
    };
    const dayDate = (index: number, forWeek: SchedulerWeek = week) => forWeek.days[index]?.localDate ?? null;

    const selectDay = (index: number) => {
        setSelection(index);
        syncUrl({ location: locationId, week: weekParam, day: dayDate(index) });
    };

    const goToWeek = (next: string | null) => {
        setWeekParam(next);
        // The same weekday in the new week; "this week" lands on today once it arrives.
        if (next === null) setSelection("today");
        else syncUrl({ location: locationId, week: next, day: addDays(next, selectedDay) });
    };

    const changeLocation = (next: string) => {
        setLocationId(next);
        edits.reset();
        syncUrl({ location: next, week: weekParam, day: dayDate(selectedDay) });
    };

    // Keep the address in step when "Today" resolves to a real day.
    useEffect(() => {
        syncUrl({ location: locationId, week: weekParam, day: week.days[selectedDay]?.localDate ?? null });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the week or day actually changes
    }, [week.weekStart, selectedDay]);

    const showToday = !week.days[selectedDay]?.isToday;

    const runPlan = (plan: Plan | null) => {
        if (!plan) return;
        void edits.run(plan);
    };

    const addShift = (dayIndex: number, person: AddShiftTarget["person"] = null, role?: string) =>
        setAddTarget({ dayIndex, person, role });

    const goToFirstOpen = () => {
        if (issues.firstDayWithOpen === null) return;
        if (layout !== "day") setLayout("day");
        selectDay(issues.firstDayWithOpen);
    };

    // ---- Keyboard -----------------------------------------------------------------
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

    // Week table taps: an empty part of a cell adds a shift there; a chip opens the shift.
    const editing: GridEditing = {
        chips: {
            onOpen: (shiftId) => setOpenShiftId(shiftId),
            onRemove: (source) => runPlan(planRemove(week, source)),
        },
        onCreateAt: (target, role) => {
            const person = target.personId ? week.people.find((p) => p.id === target.personId) ?? null : null;
            addShift(target.dayIndex, person, role);
        },
        onOpenEvent: (eventId) => setEventTarget({ mode: "edit", eventId }),
    };

    const addEvent = () => setEventTarget({ mode: "new", dayIndex: selectedDay });
    const filtered = department !== ALL_DEPARTMENTS || search.trim() !== "";
    const busy = (isValidating && !isInitial) || edits.busy;

    return (
        <div className={cn("mx-auto flex w-full flex-col gap-4 pb-32 md:pb-28", layout === "day" && "max-w-5xl")}>
            <ScheduleHeader
                week={week}
                locations={locations}
                locationId={locationId}
                onLocation={changeLocation}
                onWeek={(step) => goToWeek(addDays(week.weekStart, step * 7))}
                onToday={() => goToWeek(null)}
                showToday={showToday || !isInitial}
                layout={layout}
                onLayout={setLayout}
                department={department}
                onDepartment={setDepartment}
                search={search}
                onSearch={setSearch}
                onAddShift={() => addShift(selectedDay)}
                busy={busy}
                history={{
                    canUndo: edits.canUndo,
                    canRedo: edits.canRedo,
                    undoLabel: edits.nextUndoLabel,
                    onUndo: () => void edits.undo(),
                    onRedo: () => void edits.redo(),
                }}
                onCopyWeek={() => setCopyWeekOpen(true)}
                onTemplate={() => setTemplateOpen(true)}
                onAddEvent={addEvent}
                onRequests={() => setRequestsOpen(true)}
                onDiscard={() => setDiscardOpen(true)}
                onHelp={() => setHelpOpen(true)}
            />

            {error ? (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/30 bg-primary-soft px-4 py-3 text-sm">
                    <span>We couldn&apos;t load this week: {error.message}</span>
                    <Button size="sm" variant="outline" onClick={() => void mutate()}>
                        Try again
                    </Button>
                </div>
            ) : null}

            <div aria-busy={busy} className={cn("flex flex-col gap-4 transition-opacity", isValidating && !data && "opacity-60")}>
                {layout === "day" ? (
                    <>
                        {/* Stays under the top bar while the day's list scrolls. */}
                        <div className="sticky top-14 z-20 -mx-4 bg-page px-4 pb-3 pt-2 sm:-mx-6 sm:px-6 md:top-16 lg:-mx-8 lg:px-8">
                            <WeekStrip week={week} coverage={coverage} selected={selectedDay} onSelect={selectDay} />
                        </div>
                        <div>
                            <WeekSummary
                                week={week}
                                issues={issues}
                                openSpots={openSpots}
                                onGoToOpen={goToFirstOpen}
                                onGoToIssue={(dayIndex, shiftId) => {
                                    selectDay(dayIndex);
                                    setOpenShiftId(shiftId);
                                }}
                                onRequests={() => setRequestsOpen(true)}
                            />
                        </div>
                        <DayPanel
                            week={week}
                            dayIndex={selectedDay}
                            model={dayModel}
                            weekIsEmpty={week.shifts.length === 0}
                            filtered={filtered}
                            onOpenShift={setOpenShiftId}
                            onSuggest={setSuggestShiftId}
                            onOpenEvent={(eventId) => setEventTarget({ mode: "edit", eventId })}
                            onAdd={(dayIndex) => addShift(dayIndex)}
                            onCopyWeek={() => setCopyWeekOpen(true)}
                            onTemplate={() => setTemplateOpen(true)}
                        />
                    </>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <WeekSummary
                                week={week}
                                issues={issues}
                                openSpots={openSpots}
                                onGoToOpen={goToFirstOpen}
                                onGoToIssue={(dayIndex, shiftId) => {
                                    selectDay(dayIndex);
                                    setOpenShiftId(shiftId);
                                }}
                                onRequests={() => setRequestsOpen(true)}
                            />
                            <div role="group" aria-label="Group the table" className="flex h-10 items-center gap-0.5 rounded-full border bg-muted p-1">
                                {([
                                    ["people", "By person"],
                                    ["positions", "By role"],
                                ] as const).map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-pressed={tableMode === value}
                                        onClick={() => setTableMode(value)}
                                        className={cn(
                                            "h-8 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                                            tableMode === value && "bg-card text-foreground shadow-sm",
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {week.shifts.length === 0 ? (
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                Nothing scheduled yet.
                                <button type="button" className="font-medium text-primary hover:underline" onClick={() => setCopyWeekOpen(true)}>
                                    Copy last week
                                </button>
                                <button type="button" className="font-medium text-primary hover:underline" onClick={() => setTemplateOpen(true)}>
                                    Use a template
                                </button>
                                <span>or tap any day to add a shift.</span>
                            </p>
                        ) : null}
                        <div
                            data-testid="week-table"
                            className="max-h-[calc(100vh-14rem)] min-h-[360px] overflow-auto overscroll-contain rounded-3xl border bg-card shadow-card"
                        >
                            {tableMode === "people" ? (
                                <PeopleGrid
                                    week={week}
                                    view={peopleView}
                                    search={search}
                                    onSearch={setSearch}
                                    collapsed={collapsed}
                                    onToggleSection={(id) => {
                                        const next = new Set(collapsed);
                                        if (next.has(id)) next.delete(id);
                                        else next.add(id);
                                        setCollapsedRaw([...next].join(","));
                                    }}
                                    editing={editing}
                                />
                            ) : (
                                <PositionsGrid week={week} rows={positionRows} editing={editing} />
                            )}
                        </div>
                    </>
                )}
            </div>

            {isValidating && !data ? (
                <div className="flex w-full flex-col gap-3" aria-hidden>
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
                Times are {week.location.name}&apos;s local time ({week.location.timezone.replace(/_/g, " ")}). Changes stay with you until you
                publish. Press ? for help.
            </p>

            <PublishBar
                count={publishable}
                onPublish={() => setPublishOpen(true)}
                onDiscard={() => setDiscardOpen(true)}
            />

            <AddShiftSheet
                week={week}
                target={addTarget}
                lastRange={lastRange}
                onClose={() => setAddTarget(null)}
                onCreate={(plan, typed) => {
                    setAddTarget(null);
                    setLastRange(typed);
                    runPlan(plan);
                }}
            />
            <SuggestSheet
                week={week}
                shiftId={suggestShiftId}
                onClose={() => setSuggestShiftId(null)}
                run={(plan) => edits.run(plan)}
                onOpenShift={setOpenShiftId}
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
                    setSuggestShiftId(shiftId);
                }}
            />
            <RequestsPanel
                open={requestsOpen}
                onOpenChange={setRequestsOpen}
                onDecided={() => {
                    // Approvals change who is on shifts; the undo stack can't reach past them.
                    edits.reset();
                    void mutate();
                }}
            />
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
                        <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deletes this week&apos;s unshared shifts at {week.location.name} and puts shared shifts back the way your team sees
                            them. Other weeks and locations aren&apos;t touched. This can&apos;t be undone.
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
