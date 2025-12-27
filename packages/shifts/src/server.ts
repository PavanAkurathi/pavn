// packages/shifts/src/server.ts

import { getUpcomingShifts } from "./controllers/upcoming";
import { getPendingShifts } from "./controllers/pending";
import { getHistoryShifts } from "./controllers/history";

const port = 3005;

console.log(`🦊 Service is running at http://localhost:${port}`);

Bun.serve({
    port,
    fetch(req) {
        const url = new URL(req.url);

        // Health Check
        if (url.pathname === "/health") {
            return new Response("OK", { status: 200 });
        }

        // API Routes
        if (url.pathname === "/shifts/upcoming" && req.method === "GET") {
            return getUpcomingShifts();
        }

        if (url.pathname === "/shifts/pending-approval" && req.method === "GET") {
            return getPendingShifts();
        }

        if (url.pathname === "/shifts/history" && req.method === "GET") {
            return getHistoryShifts();
        }

        return new Response("Not Found", { status: 404 });
    },
});
