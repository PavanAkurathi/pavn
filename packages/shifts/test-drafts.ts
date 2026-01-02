
const SHIFT_SERVICE_URL = "http://localhost:4005";

// Valid IDs from DB
const VALID_ORG_ID = "ewwTgLz_yWUiuQiX4fS1E";
const VALID_LOC_ID = "SAj889FUU81HMr7sjxBYR";

async function main() {
    console.log("Testing Draft Creation...");

    const payload = {
        locationId: VALID_LOC_ID,
        organizationId: VALID_ORG_ID,
        // contactId: "user_1", // Omit to avoid FK issues for now
        timezone: "America/New_York",
        status: "draft",
        schedules: [{
            startTime: "09:00",
            endTime: "17:00",
            dates: ["2026-01-01"],
            scheduleName: "Test Draft Shift",
            positions: [{
                roleName: "Server",
                roleId: "role_1",
                workerIds: [null]
            }]
        }]
    };

    try {
        const res = await fetch(`${SHIFT_SERVICE_URL}/schedules/publish`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-org-id": VALID_ORG_ID
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log("Response Status:", res.status);
        console.log("Response Body:", JSON.stringify(data, null, 2));

        if (res.ok) {
            console.log("\nSuccess! Now verify DB...");
        } else {
            console.error("Failed to create draft");
        }

    } catch (e) {
        console.error("Fetch failed (is the server running?):", e);
    }
}

main();
