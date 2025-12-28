// packages/shifts/src/server.ts

import { getUpcomingShifts } from "./controllers/upcoming";
import { getPendingShifts } from "./controllers/pending";
import { getHistoryShifts } from "./controllers/history";
import { approveShiftController } from "./controllers/approve";
import { getShiftByIdController } from "./controllers/get-by-id";
import { getShiftTimesheetsController } from "./controllers/get-timesheets";

const port = 4005; // Moved to 4005 to avoid collisions

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

console.log(`🦊 Service is running at http://localhost:${port}`);

Bun.serve({
    port,
    async fetch(req) {
        const url = new URL(req.url);

        // 1. Handle CORS Preflight (Browser Security Check)
        if (req.method === "OPTIONS") {
            return new Response(null, {
                headers: CORS_HEADERS
            });
        }

        let response: Response;

        // Handle POST /shifts/:id/approve
        const approveMatch = url.pathname.match(/^\/shifts\/([^/]+)\/approve$/);
        // Handle GET /shifts/:id/timesheets
        const timesheetsMatch = url.pathname.match(/^\/shifts\/([^/]+)\/timesheets$/);
        // Handle GET /shifts/:id (Must be last specific ID match to avoid conflicts)
        const idMatch = url.pathname.match(/^\/shifts\/([^/]+)$/);

        try {
            // Health Check
            if (url.pathname === "/health") {
                response = new Response("OK", { status: 200 });
            }
            else if (approveMatch && approveMatch[1] && req.method === "POST") {
                const shiftId = approveMatch[1];
                response = await approveShiftController(shiftId);
            }
            else if (timesheetsMatch && timesheetsMatch[1] && req.method === "GET") {
                const shiftId = timesheetsMatch[1];
                response = await getShiftTimesheetsController(shiftId);
            }
            // API Routes
            else if (url.pathname === "/shifts/upcoming" && req.method === "GET") {
                response = await getUpcomingShifts();
            }
            else if (url.pathname === "/shifts/pending-approval" && req.method === "GET") {
                response = await getPendingShifts();
            }
            else if (url.pathname === "/shifts/history" && req.method === "GET") {
                response = await getHistoryShifts();
            }
            // Generic ID route must be checked AFTER specific static routes like /upcoming
            else if (idMatch && idMatch[1] && req.method === "GET") {
                const shiftId = idMatch[1];
                // Exclude static paths if regex matched them by mistake (e.g. if I handled upcoming with regex)
                // But here static paths are handled by explicit checks above, so this else-if is safe
                // provided "upcoming" doesn't match the regex or is handled first. 
                // "upcoming" matches ([^/]+) but we handled keys like "upcoming" explicitly above.
                // Wait! /shifts/upcoming matches /shifts/([^/]+).
                // So we MUST ensure this `else if` comes AFTER the static route checks.
                response = await getShiftByIdController(shiftId);
            }
            else {
                response = new Response("Not Found", { status: 404 });
            }
        } catch (error) {
            console.error(error);
            response = new Response("Internal Server Error", { status: 500 });
        }

        // 3. Attach CORS headers to the actual data response
        for (const [key, value] of Object.entries(CORS_HEADERS)) {
            response.headers.set(key, value);
        }

        return response;
    },
});
