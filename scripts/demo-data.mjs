/**
 * Demo data for local development — the ONLY place it is defined.
 *
 *   bun scripts/demo-data.mjs seed     # create it
 *   bun scripts/demo-data.mjs clear    # remove every trace of it
 *   bun scripts/demo-data.mjs status   # what exists right now
 *
 * Every row this creates carries the DEMO_PREFIX in its id, so `clear` is an
 * exact delete rather than a guess. Nothing else in the codebase should insert
 * fixture rows; when the demo is no longer wanted, delete this file and run
 * `clear` first.
 *
 * Run with `bun --env-file=.env` so DATABASE_URL is present.
 */
import { neon } from "@neondatabase/serverless";

const DEMO_PREFIX = "demo_";

const sql = neon(process.env.DATABASE_URL);

/** Tables that can hold demo rows, in delete order (children first). */
const DEMO_TABLES = [
    { table: "shift_assignment", column: "id" },
    { table: "shift", column: "id" },
    { table: "temp_worker", column: "id" },
];

async function firstOrg() {
    const rows = await sql.query(`select id, timezone from organization order by created_at limit 1`);
    if (!rows[0]) throw new Error("No organization exists — sign up first, then seed.");
    return rows[0];
}

async function firstLocation(orgId) {
    const rows = await sql.query(
        `select id, name, timezone from location where organization_id = $1 order by created_at limit 1`,
        [orgId],
    );
    if (!rows[0]) throw new Error("No location exists — finish onboarding first, then seed.");
    return rows[0];
}

/** Sunday of the coming week, so demo shifts are always in the future. */
function upcoming(dayOffset, hour) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + dayOffset);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
}

async function seed() {
    const org = await firstOrg();
    const location = await firstLocation(org.id);
    const timezone = location.timezone || org.timezone || "America/New_York";

    // A block with three positions: one short-staffed, one full, one large
    // enough to exercise the collapsed avatar stack on the shift card.
    const positions = [
        { key: "fork", title: "Forklift Operator", capacity: 3, staff: 2 },
        { key: "super", title: "Supervisor", capacity: 1, staff: 1 },
        { key: "loader", title: "Loader", capacity: 30, staff: 26 },
    ];

    const start = upcoming(7, 13);
    const end = upcoming(7, 21);

    for (const position of positions) {
        const shiftId = `${DEMO_PREFIX}shift_${position.key}`;
        await sql.query(
            `insert into shift (id, organization_id, location_id, title, start_time, end_time, timezone, capacity_total, status)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             on conflict (id) do update set capacity_total = excluded.capacity_total, timezone = excluded.timezone`,
            [shiftId, org.id, location.id, position.title, start, end, timezone, position.capacity, "published"],
        );

        for (let i = 1; i <= position.staff; i += 1) {
            const workerId = `${DEMO_PREFIX}worker_${position.key}_${i}`;
            await sql.query(
                `insert into temp_worker (id, organization_id, name) values ($1,$2,$3) on conflict (id) do nothing`,
                [workerId, org.id, `Demo Worker ${i}`],
            );
            await sql.query(
                `insert into shift_assignment (id, shift_id, temp_worker_id, status)
                 values ($1,$2,$3,$4) on conflict (id) do nothing`,
                [`${DEMO_PREFIX}assignment_${position.key}_${i}`, shiftId, workerId, "active"],
            );
        }
    }

    console.log(`Seeded demo data at ${location.name} (${timezone}).`);
    await status();
}

async function clear() {
    for (const { table, column } of DEMO_TABLES) {
        const result = await sql.query(`delete from "${table}" where ${column} like $1`, [`${DEMO_PREFIX}%`]);
        console.log(`  cleared ${table}: ${result.length ?? 0} rows matched`);
    }
    console.log("Demo data removed.");
}

async function status() {
    for (const { table, column } of DEMO_TABLES) {
        const rows = await sql.query(
            `select count(*)::int as n from "${table}" where ${column} like $1`,
            [`${DEMO_PREFIX}%`],
        );
        console.log(`  ${table}: ${rows[0].n}`);
    }
}

const command = process.argv[2];
const commands = { seed, clear, status };

if (!commands[command]) {
    console.error("Usage: bun --env-file=.env scripts/demo-data.mjs <seed|clear|status>");
    process.exit(1);
}

await commands[command]();
