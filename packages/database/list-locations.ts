
import { db } from "./src/index";
import { location } from "./src/schema";

async function main() {
    console.log("Listing Locations...");
    const locs = await db.select().from(location);

    if (locs.length === 0) {
        console.log("No locations found!");
    } else {
        console.table(locs.map(l => ({ id: l.id, name: l.name, orgId: l.organizationId })));
    }
    process.exit(0);
}

main().catch(console.error);
