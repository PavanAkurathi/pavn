
import { db } from "./src/index";
import { organization } from "./src/schema";

async function main() {
    console.log("Listing Organizations...");
    const orgs = await db.select().from(organization);

    if (orgs.length === 0) {
        console.log("No organizations found!");
    } else {
        console.table(orgs.map(o => ({ id: o.id, name: o.name, slug: o.slug })));
    }
    process.exit(0);
}

main().catch(console.error);
