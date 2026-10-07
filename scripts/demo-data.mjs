/**
 * Demo data for local development, and the ONLY place it is defined.
 *
 * A believable small restaurant, so a manager can click through the whole
 * business side: the Team list in every state, a week of shifts (staffed, open
 * and drafted), timesheets waiting for approval, last week's approved hours for
 * Reports and the export, and requests waiting for a decision.
 *
 *   bun --env-file=.env scripts/demo-data.mjs seed --org "Walkthrough Cafe" --reset [--rename "Harbor Street Café"] [--address "350 5th Avenue, New York, NY 10118"]
 *   bun --env-file=.env scripts/demo-data.mjs clear      # remove every demo row
 *   bun --env-file=.env scripts/demo-data.mjs status     # what exists right now
 *
 * Every row it creates carries DEMO_PREFIX in its id, so `clear` is an exact
 * delete. `--reset` first empties the named business's shifts, requests, time
 * off and workers (use it on a throwaway dev business only). Dates are relative
 * to today, so the demo is never stale: run `seed` again before a showing.
 *
 * It refuses to run against the production database.
 */
import { neon } from "@neondatabase/serverless";

const DEMO_PREFIX = "demo_";
// The API only accepts request ids shaped `req_<letters/digits>` / `tor_<letters/digits>`, so these two
// carry the marker after the prefix (no underscore) rather than in front of it.
const REQUEST_PREFIX = "req_demo";
const TIME_OFF_PREFIX = "tor_demo";
const PRODUCTION_ENDPOINT = "ep-solitary-dew-aid3b45m";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Run with `bun --env-file=.env`.");
if (process.env.DATABASE_URL.includes(PRODUCTION_ENDPOINT) || process.env.NODE_ENV === "production") {
    throw new Error("Refusing to write demo data to production.");
}

const sql = neon(process.env.DATABASE_URL);
const run = (text, params = []) => sql.query(text, params);

// ---------------------------------------------------------------------------
// Time helpers: shifts are anchored to the venue's wall clock.
// ---------------------------------------------------------------------------

function wallToUtc(y, m, d, hh, mm, tz) {
    const target = Date.UTC(y, m - 1, d, hh, mm);
    let utc = target;
    for (let i = 0; i < 3; i += 1) {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
        }).formatToParts(new Date(utc));
        const get = (t) => Number(parts.find((p) => p.type === t).value);
        utc += target - Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    }
    return new Date(utc);
}

function localToday(tz) {
    const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()).split("-").map(Number);
    return { y, m, d };
}

/** Local calendar date `offset` days from today. */
function dayAt(tz, offset) {
    const t = localToday(tz);
    const base = new Date(Date.UTC(t.y, t.m - 1, t.d + offset));
    return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate(), dow: base.getUTCDay() };
}

// Small deterministic jitter so clock times look human but never change between runs.
let seedState = 7;
const jitter = (max) => {
    seedState = (seedState * 1103515245 + 12345) % 2147483648;
    return seedState % (max + 1);
};

const code = (n) => `DEMO${String(n).padStart(4, "0")}`.replace(/[0O]/g, "2").slice(0, 8);

// ---------------------------------------------------------------------------
// The business
// ---------------------------------------------------------------------------

const WORKERS = [
    // On the app (have signed in): they can send requests.
    { key: "maria", name: "Maria Santos", role: "Server", status: "active", rate: 1800 },
    { key: "devon", name: "Devon Clarke", role: "Server", status: "active", rate: 1750 },
    { key: "priya", name: "Priya Patel", role: "Bartender", status: "active", rate: 2200 },
    { key: "marcus", name: "Marcus Johnson", role: "Line Cook", status: "active", rate: 2400 },
    { key: "elena", name: "Elena Rossi", role: "Host", status: "active", rate: 1700 },
    { key: "tom", name: "Tom Nguyen", role: "Dishwasher", status: "active", rate: 1650 },
    // Invited by text, haven't signed in yet.
    { key: "jasmine", name: "Jasmine Carter", role: "Server", status: "invited", rate: 1750 },
    { key: "luis", name: "Luis Ortega", role: "Line Cook", status: "invited", rate: 2300 },
    { key: "noah", name: "Noah Fischer", role: "Host", status: "invited", rate: 1700 },
    // On the list, not invited yet.
    { key: "aaliyah", name: "Aaliyah Brooks", role: "Bartender", status: "added", rate: 2100 },
    { key: "sam", name: "Sam Kowalski", role: "Server", status: "added", rate: 1700 },
];
const TEMP = { key: "temp1", name: "Temp 1", agency: "ABC Staffing" };

const POOLS = {
    server: ["maria", "devon", "jasmine", "sam"],
    bar: ["priya", "aaliyah"],
    cook: ["marcus", "luis"],
    host: ["elena", "noah"],
    dish: ["tom"],
};

// Planned breaks follow the app's own guidance (15 / 30 / 45 min for 4 / 6 / 8 hour shifts),
// so a worked shift only needs review when something really is off.
const PATTERNS = [
    { key: "lunch", title: "Server", start: [11, 0], end: [16, 0], cap: 2, days: [1, 2, 3, 4, 5], pool: "server", brk: 15 },
    { key: "dinner", title: "Server", start: [17, 0], end: [23, 0], cap: 3, days: [2, 3, 4, 5, 6, 0], pool: "server", brk: 30 },
    { key: "bar", title: "Bartender", start: [17, 0], end: [24, 0], cap: 1, days: [3, 4, 5, 6, 0], pool: "bar", brk: 30 },
    { key: "cook", title: "Line Cook", start: [10, 0], end: [18, 0], cap: 2, days: [1, 2, 3, 4, 5, 6], pool: "cook", brk: 45 },
    { key: "host", title: "Host", start: [17, 0], end: [22, 0], cap: 1, days: [4, 5, 6, 0], pool: "host", brk: 15 },
    { key: "dish", title: "Dishwasher", start: [16, 0], end: [23, 0], cap: 1, days: [5, 6, 0], pool: "dish", brk: 30 },
];

/** Spots deliberately left open in the days ahead, by pattern and days from today. */
const OPEN_SPOTS = { "dinner:3": 2, "dinner:2": 1, "bar:4": 1, "cook:5": 1 };

async function findOrg(name) {
    const rows = await run(`select id, name, timezone from organization where name = $1 limit 1`, [name]);
    if (!rows[0]) throw new Error(`No business named "${name}". Pass --org "<name>".`);
    const loc = (await run(`select id, timezone from location where organization_id = $1 order by created_at limit 1`, [rows[0].id]))[0];
    if (!loc) throw new Error("That business has no location yet. Finish onboarding first.");
    return { ...rows[0], locationId: loc.id, tz: loc.timezone || rows[0].timezone || "America/New_York" };
}

async function chunked(items, size, fn) {
    for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

async function reset(orgId) {
    await run(`delete from shift where organization_id = $1`, [orgId]); // cascades assignments and shift requests
    await run(`delete from time_off_request where organization_id = $1`, [orgId]);
    await run(`delete from worker where organization_id = $1`, [orgId]);
    await run(`delete from member where organization_id = $1 and role = 'member'`, [orgId]);
}

async function seed(args) {
    const orgName = args.org;
    if (!orgName) throw new Error('Pass --org "<business name>".');
    const org = await findOrg(orgName);
    const { tz } = org;
    const now = new Date();

    if (args.reset) await reset(org.id);
    else await clear({ quiet: true });

    if (args.rename) {
        await run(`update organization set name = $1 where id = $2`, [args.rename, org.id]);
        await run(`update location set name = $1 where id = $2`, [`${args.rename} - Midtown`, org.locationId]);
    }
    if (args.address) await run(`update location set address = $1 where id = $2`, [args.address, org.locationId]);

    // ---- Workers (and the accounts of the ones who are on the app) ----------
    const phone = (i) => `+1212555${String(1000 + i)}`;
    const workerId = (key) => `${DEMO_PREFIX}wkr_${key}`;
    const userId = (key) => `${DEMO_PREFIX}user_${key}`;
    const byKey = new Map(WORKERS.map((w, i) => [w.key, { ...w, i }]));

    for (const [i, w] of WORKERS.entries()) {
        if (w.status === "active") {
            await run(
                `insert into "user" (id, name, email, email_verified, phone_number, role, timezone, created_at, updated_at)
                 values ($1,$2,$3,true,$4,'worker',$5,now(),now()) on conflict (id) do nothing`,
                [userId(w.key), w.name, `demo.${w.key}@demo.pavn.test`, phone(i), tz],
            );
            await run(
                `insert into member (id, organization_id, user_id, role, status, created_at, updated_at)
                 values ($1,$2,$3,'member','active',now(),now()) on conflict (id) do nothing`,
                [`${DEMO_PREFIX}member_${w.key}`, org.id, userId(w.key)],
            );
        }
        await run(
            `insert into worker (id, organization_id, user_id, name, phone_number, employment_type, job_title, roles, hourly_rate, invite_code, status, invited_at, created_at, updated_at)
             values ($1,$2,$3,$4,$5,'staff',$6,$7::jsonb,$8,$9,$10,$11,now() - ($12::text || ' days')::interval,now())
             on conflict (id) do nothing`,
            [
                workerId(w.key), org.id, w.status === "active" ? userId(w.key) : null, w.name, phone(i), w.role,
                JSON.stringify([w.role]), w.rate, w.status === "added" ? null : code(i + 1), w.status,
                w.status === "added" ? null : now, String(20 - i),
            ],
        );
    }
    await run(
        `insert into worker (id, organization_id, name, employment_type, agency, status, created_at, updated_at)
         values ($1,$2,$3,'agency',$4,'added',now(),now()) on conflict (id) do nothing`,
        [workerId(TEMP.key), org.id, TEMP.name, TEMP.agency],
    );

    // ---- Shifts: last week approved, this week live, next week drafted -----
    const busy = new Map(); // worker key -> [[startMs, endMs]]
    const free = (key, s, e) => !(busy.get(key) ?? []).some(([a, b]) => s < b && e > a);
    const book = (key, s, e) => busy.set(key, [...(busy.get(key) ?? []), [s, e]]);
    const rotation = { server: 0, bar: 0, cook: 0, host: 0, dish: 0 };

    const shifts = [];
    const assignments = [];
    let sn = 0;
    let an = 0;

    const weekStartOffset = -dayAt(tz, 0).dow; // Sunday of this week, as days from today

    const makeShift = (offset, p, state) => {
        const day = dayAt(tz, offset);
        const start = wallToUtc(day.y, day.m, day.d, p.start[0], p.start[1], tz);
        const endDay = p.end[0] === 24 ? dayAt(tz, offset + 1) : day;
        const end = wallToUtc(endDay.y, endDay.m, endDay.d, p.end[0] === 24 ? 0 : p.end[0], p.end[1], tz);
        return { id: `${DEMO_PREFIX}shift_${String(sn += 1).padStart(3, "0")}`, p, offset, start, end, state, cap: p.cap };
    };

    const pick = (shift, count, activeOnly) => {
        const pool = POOLS[shift.p.pool].filter((key) => !activeOnly || byKey.get(key).status === "active");
        const chosen = [];
        for (let tries = 0; tries < pool.length * 2 && chosen.length < count; tries += 1) {
            const key = pool[(rotation[shift.p.pool] += 1) % pool.length];
            if (!chosen.includes(key) && free(key, shift.start.getTime(), shift.end.getTime())) chosen.push(key);
        }
        for (const key of chosen) book(key, shift.start.getTime(), shift.end.getTime());
        return chosen;
    };

    for (const weekOffset of [-7, 0, 7]) {
        for (let dayIdx = 0; dayIdx < 7; dayIdx += 1) {
            const offset = weekStartOffset + weekOffset + dayIdx;
            const dow = dayAt(tz, offset).dow;
            for (const p of PATTERNS) {
                if (!p.days.includes(dow)) continue;
                const shift = makeShift(offset, p);
                const past = shift.end < now;
                const upcoming = shift.start > now;

                if (weekOffset === 7) {
                    // Next week: only Mon–Wed so far, as drafts the manager is still building.
                    if (![1, 2, 3].includes(dow) || !["lunch", "dinner", "cook"].includes(p.key)) continue;
                    shift.state = "draft";
                    shift.keys = pick(shift, Math.max(1, p.cap - 1), false);
                } else if (weekOffset === -7) {
                    shift.state = "approved";
                    shift.keys = pick(shift, p.cap, true);
                } else if (past) {
                    shift.state = "completed";
                    shift.keys = pick(shift, p.cap, true);
                } else if (shift.start <= now) {
                    // Happening right now: the people on it have clocked in.
                    shift.state = "in-progress";
                    shift.keys = pick(shift, p.cap, true);
                } else {
                    const open = upcoming ? OPEN_SPOTS[`${p.key}:${offset}`] ?? 0 : 0;
                    shift.keys = pick(shift, Math.max(0, p.cap - open), false);
                    shift.state = shift.keys.length >= p.cap ? "assigned" : "published";
                }
                // Nobody is "open" on a shift that has already happened: capacity is who worked it.
                if (["completed", "approved", "in-progress"].includes(shift.state)) shift.cap = Math.max(1, shift.keys.length);
                shifts.push(shift);
            }
        }
    }

    // Two scenarios worth showing, made deterministic: a conflict (Devon has approved time off on a
    // day he is rostered for dinner) and a swap (Maria hands her Friday-style dinner to Devon).
    const refill = (shift) => {
        shift.state = shift.keys.length >= shift.cap ? "assigned" : "published";
    };
    const live = (s) => ["published", "assigned"].includes(s.state);
    const warnShift = shifts.find((s) => s.p.key === "dinner" && s.offset === 2 && live(s));
    let warnDevon = false;
    if (warnShift) {
        if (!warnShift.keys.includes("devon")) warnShift.keys = ["devon", ...warnShift.keys.slice(0, warnShift.cap - 1)];
        refill(warnShift);
        warnDevon = true;
    }
    const swapShift = shifts.find((s) => s.p.key === "dinner" && s.offset === 4 && live(s) && s !== warnShift);
    if (swapShift) {
        swapShift.keys = swapShift.keys.filter((k) => k !== "devon");
        if (!swapShift.keys.includes("maria")) swapShift.keys = ["maria", ...swapShift.keys.slice(0, swapShift.cap - 1)];
        refill(swapShift);
    }

    let flagged = 0;
    for (const shift of shifts) {
        const hours = (shift.end - shift.start) / 3600000;
        const planned = shift.p.brk;
        for (const key of shift.keys) {
            const base = {
                id: `${DEMO_PREFIX}asg_${String((an += 1)).padStart(4, "0")}`,
                shift: shift.id, worker: workerId(key), status: "active", pending: shift.state === "draft" ? "add" : null,
                actualIn: null, actualOut: null, effIn: null, effOut: null, brk: 0, total: 0,
                verified: false, method: null, review: false, reason: null,
            };
            if (shift.state === "in-progress") {
                const inAt = new Date(shift.start.getTime() + jitter(6) * 60000);
                base.actualIn = inAt; base.effIn = shift.start; base.verified = true; base.method = "geofence";
            }
            if (shift.state === "completed" || shift.state === "approved") {
                const inAt = new Date(shift.start.getTime() + jitter(8) * 60000);
                const outAt = new Date(shift.end.getTime() + jitter(14) * 60000);
                base.actualIn = inAt; base.actualOut = outAt;
                base.effIn = shift.start; base.effOut = outAt;
                base.brk = planned;
                base.total = Math.round((outAt - shift.start) / 60000) - planned;
                base.verified = true; base.method = "geofence";
                base.status = shift.state === "approved" ? "approved" : "completed";
                // A few rows a manager has to look at before approving this week.
                if (shift.state === "completed") {
                    flagged += 1;
                    if (flagged === 3) { base.actualOut = null; base.effOut = null; base.total = 0; base.review = true; base.reason = "no_clockout"; }
                    if (flagged === 5) { base.review = true; base.reason = "left_geofence"; }
                    if (flagged === 7) { base.actualIn = null; base.actualOut = null; base.effIn = null; base.effOut = null; base.total = 0; base.brk = 0; base.status = "no_show"; base.verified = false; base.method = null; }
                }
            }
            assignments.push(base);
        }
        shift.hours = hours;
        shift.status = shift.state;
    }

    await chunked(shifts, 8, (s) =>
        run(
            `insert into shift (id, organization_id, location_id, title, start_time, end_time, timezone, capacity_total, status, break_minutes, published_at, created_at, updated_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now()) on conflict (id) do nothing`,
            [s.id, org.id, org.locationId, s.p.title, s.start.toISOString(), s.end.toISOString(), tz, s.cap, s.status, s.p.brk, s.state === "draft" ? null : now.toISOString()],
        ),
    );
    await chunked(assignments, 8, (a) =>
        run(
            `insert into shift_assignment (id, shift_id, worker_id, status, pending_state, actual_clock_in, actual_clock_out, effective_clock_in, effective_clock_out,
                break_minutes, total_duration_minutes, clock_in_verified, clock_in_method, clock_out_verified, clock_out_method, needs_review, review_reason, created_at, updated_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$12,$13,$14,$15,now(),now()) on conflict (id) do nothing`,
            [
                a.id, a.shift, a.worker, a.status, a.pending, a.actualIn?.toISOString() ?? null, a.actualOut?.toISOString() ?? null,
                a.effIn?.toISOString() ?? null, a.effOut?.toISOString() ?? null, a.brk, a.total, a.verified, a.method, a.review, a.reason,
            ],
        ),
    );

    // An agency temp covers one open dinner so the Timesheets page shows both kinds of worker.
    const tempShift = shifts.find((s) => s.p.key === "dinner" && s.offset === 3 && s.state === "published");
    if (tempShift) {
        await run(
            `insert into shift_assignment (id, shift_id, worker_id, status, created_at, updated_at) values ($1,$2,$3,'active',now(),now()) on conflict (id) do nothing`,
            [`${DEMO_PREFIX}asg_temp`, tempShift.id, workerId(TEMP.key)],
        );
    }

    // ---- Requests and time off waiting on the manager ----------------------
    const shiftAt = (key, offset) => shifts.find((s) => s.p.key === key && s.offset === offset && ["published", "assigned"].includes(s.status));
    const assignedActive = (s) => (s?.keys ?? []).find((k) => byKey.get(k).status === "active");
    const requests = [];

    const claim = shiftAt("dinner", 3);
    if (claim) requests.push(["claim", claim, "devon", null, "I can cover this one."]);
    const drop = shiftAt("lunch", 1) ?? shiftAt("lunch", 2) ?? shiftAt("lunch", 3);
    if (drop && assignedActive(drop)) requests.push(["drop", drop, assignedActive(drop), null, "Doctor's appointment, sorry for the short notice."]);
    const swap = shiftAt("dinner", 4);
    if (swap && swap.keys.includes("maria") && !swap.keys.includes("devon")) requests.push(["swap", swap, "maria", "devon", "Devon said yes to taking my shift."]);

    for (const [i, [type, s, requester, target, note]] of requests.entries()) {
        await run(
            `insert into shift_request (id, organization_id, type, shift_id, requester_worker_id, target_worker_id, status, note, created_at, updated_at)
             values ($1,$2,$3,$4,$5,$6,'pending_manager',$7, now() - ($8::text || ' hours')::interval, now()) on conflict (id) do nothing`,
            [`${REQUEST_PREFIX}${i}`, org.id, type, s.id, userId(requester), target ? userId(target) : null, note, String(3 + i * 5)],
        );
    }

    const off = async (id, key, from, to, reason, status) => {
        const a = dayAt(tz, from);
        const b = dayAt(tz, to + 1);
        await run(
            `insert into time_off_request (id, organization_id, worker_id, start_time, end_time, all_day, reason, status, decided_at, created_at, updated_at)
             values ($1,$2,$3,$4,$5,true,$6,$7,$8,now() - interval '1 day',now()) on conflict (id) do nothing`,
            [id, org.id, userId(key), wallToUtc(a.y, a.m, a.d, 0, 0, tz).toISOString(), wallToUtc(b.y, b.m, b.d, 0, 0, tz).toISOString(), reason, status, status === "pending" ? null : now.toISOString()],
        );
    };
    await off(`${TIME_OFF_PREFIX}elena`, "elena", 3, 4, "Cousin's wedding", "pending");
    await off(`${TIME_OFF_PREFIX}tom`, "tom", 6, 6, "Dentist", "pending");
    if (warnDevon) await off(`${TIME_OFF_PREFIX}devon`, "devon", 2, 2, "Moving day", "approved");

    console.log(`Seeded "${args.rename ?? org.name}" (${tz}): ${WORKERS.length + 1} workers, ${shifts.length} shifts, ${assignments.length} assignments, ${requests.length} requests.`);
    await status();
}

async function clear({ quiet = false } = {}) {
    await run(`delete from shift where id like $1`, [`${DEMO_PREFIX}%`]);
    await run(`delete from shift_request where starts_with(id, $1)`, [REQUEST_PREFIX]);
    await run(`delete from time_off_request where starts_with(id, $1)`, [TIME_OFF_PREFIX]);
    await run(`delete from worker where id like $1`, [`${DEMO_PREFIX}%`]);
    await run(`delete from member where id like $1`, [`${DEMO_PREFIX}%`]);
    await run(`delete from "user" where id like $1`, [`${DEMO_PREFIX}%`]);
    if (!quiet) console.log("Demo data removed.");
}

async function status() {
    for (const { label, table, prefix } of [
        { label: "workers", table: "worker", prefix: DEMO_PREFIX }, { label: "shifts", table: "shift", prefix: DEMO_PREFIX },
        { label: "assignments", table: "shift_assignment", prefix: DEMO_PREFIX },
        { label: "shift requests", table: "shift_request", prefix: REQUEST_PREFIX }, { label: "time off", table: "time_off_request", prefix: TIME_OFF_PREFIX },
    ]) {
        const rows = await run(`select count(*)::int as n from "${table}" where starts_with(id, $1)`, [prefix]);
        console.log(`  ${label}: ${rows[0].n}`);
    }
}

const [command, ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--reset") args.reset = true;
    else if (rest[i].startsWith("--")) args[rest[i].slice(2)] = rest[++i];
}

const commands = { seed: () => seed(args), clear: () => clear(), status };
if (!commands[command]) {
    console.error('Usage: bun --env-file=.env scripts/demo-data.mjs <seed --org "<name>" [--reset] [--rename "<new name>"] [--address "<address>"] | clear | status>');
    process.exit(1);
}
await commands[command]();
