import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

type JournalEntry = {
    idx: number;
    when: number;
    tag: string;
};

type Journal = {
    entries: JournalEntry[];
};

const DRIZZLE_DIR = join(import.meta.dir, "..", "drizzle");
const JOURNAL_PATH = join(DRIZZLE_DIR, "meta", "_journal.json");

const splitStatements = (rawSql: string) =>
    rawSql
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);

async function main() {
    const journal = JSON.parse(await readFile(JOURNAL_PATH, "utf8")) as Journal;
    const appliedRows = await db.execute(sql`
        SELECT hash
        FROM drizzle.__drizzle_migrations
        ORDER BY created_at ASC
    `);
    const appliedHashes = new Set(
        (appliedRows.rows ?? []).map((row: Record<string, unknown>) => String(row.hash))
    );

    for (const entry of journal.entries) {
        if (entry.idx === 0) continue;

        const filename = `${entry.tag}.sql`;
        const filepath = join(DRIZZLE_DIR, filename);
        const fileContents = await readFile(filepath, "utf8");
        const hash = createHash("sha256").update(fileContents).digest("hex");

        if (appliedHashes.has(hash)) {
            console.log(`Skipping already applied migration ${entry.tag}`);
            continue;
        }

        console.log(`Applying ${entry.tag}...`);
        const statements = splitStatements(fileContents);

        for (const statement of statements) {
            await db.execute(sql.raw(statement));
        }

        await db.execute(sql`
            INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
            VALUES (${hash}, ${String(entry.when)})
        `);

        console.log(`Applied ${entry.tag}`);
    }
}

await main();
