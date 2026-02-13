// packages/database/src/schema.ts

import { pgTable, text, timestamp, boolean, index, json, integer, unique, decimal, customType, jsonb, time, uniqueIndex, bigint } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// PostGIS Geometry Type Helper
const geography = customType<{ data: string }>({
    dataType() {
        return "geography(POINT, 4326)";
    },
});

// ============================================================================
// 1. IDENTITY & AUTH (Using Account Table for better compatibility)
// ============================================================================

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    phoneNumber: text("phone_number"),
    stripeCustomerId: text("stripe_customer_id"),

    // Profile Extensions
    emergencyContact: json("emergency_contact").$type<{
        name: string;
        phone: string;
        relation: string;
    }>(),
    address: json("address").$type<{
        street: string;
        city: string;
        state: string;
        zip: string;
    }>(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => ({
    userEmailIdx: index("user_email_idx").on(table.email)
}));

export const certification = pgTable("certification", {
    id: text("id").primaryKey(),
    workerId: text("worker_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "ServSafe Alcohol"
    issuer: text("issuer"), // e.g., "National Restaurant Association"
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'date' }),
    status: text("status").default("valid"), // 'valid', 'expired'
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    certWorkerIdx: index("cert_worker_idx").on(table.workerId)
}));

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'date' }),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => ({
    accountUserIdx: index("account_user_idx").on(table.userId),
    accountProviderIdx: index("account_provider_idx").on(table.providerId, table.accountId)
}));

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'date' }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }), // Cascade delete
    activeOrganizationId: text("active_organization_id"), // Context Key
}, (table) => ({
    sessionUserIdx: index("session_user_idx").on(table.userId)
}));

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }),
});

export const userRelations = relations(user, ({ many }) => ({
    certifications: many(certification),
    // specific relations to shifts/assignments can be added here if needed, 
    // but often handled via the other side (shiftAssignment.worker)
}));

// ============================================================================
// 2. TENANCY (Organization & Location)
// ============================================================================

export const organization = pgTable("organization", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull(),
    metadata: text("metadata"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    subscriptionStatus: text("subscription_status").default("inactive"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'date' }),

    // Configuration
    earlyClockInBufferMinutes: integer("early_clock_in_buffer_minutes").notNull().default(60),
    currencyCode: text("currency_code").notNull().default("USD"),
    timezone: text("timezone").notNull().default("America/New_York"), // Default to EST/EDT or UTC? User said 'timezone'. Falling back to a safe default.
    breakThresholdMinutes: integer("break_threshold_minutes"), // Custom rule override
    regionalOvertimePolicy: text("regional_overtime_policy").notNull().default("weekly_40"), // 'weekly_40' | 'daily_8'
});

export const location = pgTable("location", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    address: text("address"),
    zip: text("zip"), // Added for explicit zip code storage
    parking: text("parking").default("free"),
    specifics: json("specifics").$type<string[]>(),
    instructions: text("instructions"),

    // -- Geofence --
    position: geography("position"),
    geofenceRadius: integer("geofence_radius").default(100),
    geocodedAt: timestamp("geocoded_at", { withTimezone: true, mode: 'date' }),
    geocodeSource: text("geocode_source"), // 'google' | 'manual' | 'mapbox'

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => ({
    locationOrgIdx: index("location_org_idx").on(table.organizationId),
    locationPosIdx: index("location_pos_idx").using("gist", table.position) // GIST Index for PostGIS
}));

// ============================================================================
// 3. MEMBERSHIP & ROLES (Admin vs Member)
// ============================================================================

export const member = pgTable("member", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "admin" | "member"
    status: text("status").notNull().default("active"), // "active" | "inactive" | "invited"
    hourlyRate: integer("hourly_rate"), // Stored in cents, nullable
    jobTitle: text("job_title"), // e.g. "Security Guard", nullable
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    memberOrgIdx: index("member_org_idx").on(table.organizationId),
    memberUserIdx: index("member_user_idx").on(table.userId),
    memberOrgUserUnique: unique("member_org_user_unique").on(table.organizationId, table.userId)
}));

export const invitation = pgTable("invitation", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'date' }).notNull(),
    inviterId: text("inviter_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
});

export const memberRelations = relations(member, ({ one }) => ({
    organization: one(organization, {
        fields: [member.organizationId],
        references: [organization.id],
    }),
    user: one(user, {
        fields: [member.userId],
        references: [user.id],
    }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
    organization: one(organization, {
        fields: [invitation.organizationId],
        references: [organization.id],
    }),
    inviter: one(user, {
        fields: [invitation.inviterId],
        references: [user.id],
    }),
}));

// ============================================================================
// 4. SCHEDULING (Shifts & Assignments)
// ============================================================================

export const shift = pgTable("shift", {
    id: text("id").primaryKey(),

    // -- Tenancy --
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),

    // Link to your existing Location table
    locationId: text("location_id")
        .references(() => location.id, { onDelete: "set null" }),

    // Onsite Point of Contact (Manager)
    contactId: text("contact_id")
        .references(() => user.id, { onDelete: "set null" }),

    // -- Details --
    title: text("title").notNull(), // e.g. "Event Security"
    description: text("description"),

    startTime: timestamp("start_time", { withTimezone: true, mode: 'date' }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true, mode: 'date' }).notNull(),

    // -- Capacity --
    capacityTotal: integer("capacity_total").notNull().default(1),

    // -- Money (Stored in Cents) --
    price: integer("price").default(0), // Internal only — future marketplace


    // -- State --
    // Values: 'published', 'assigned', 'in-progress', 'completed', 'approved', 'cancelled'
    status: text("status").notNull().default("published"),

    // -- Grouping --
    scheduleGroupId: text("schedule_group_id"), // "int_..." for batched operations

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    shiftOrgIdx: index("shift_org_idx").on(table.organizationId),
    shiftStatusIdx: index("shift_status_idx").on(table.status),
    shiftTimeIdx: index("shift_time_idx").on(table.startTime),
    // New Indexes (WH-006)
    shiftOrgStatusIdx: index("shift_org_status_idx").on(table.organizationId, table.status),
    shiftOrgTimeIdx: index("shift_org_time_idx").on(table.organizationId, table.startTime),
    shiftStatusTimeIdx: index("shift_status_time_idx").on(table.status, table.startTime).where(sql`status IN ('published', 'assigned', 'in-progress')`),
    shiftLocationIdx: index("shift_location_idx").on(table.locationId),
}));

export const shiftAssignment = pgTable("shift_assignment", {
    id: text("id").primaryKey(),

    // -- Relationships --
    shiftId: text("shift_id")
        .notNull()
        .references(() => shift.id, { onDelete: "cascade" }),

    workerId: text("worker_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),

    // -- Timesheet Data (Triple-Timestamp Model) --
    // 1. Actual (Behavioral) - Raw device timestamp
    actualClockIn: timestamp("actual_clock_in", { withTimezone: true, mode: 'date' }),
    actualClockOut: timestamp("actual_clock_out", { withTimezone: true, mode: 'date' }),

    // 2. Effective (Billable/Payable) - Rounded/Snapped
    effectiveClockIn: timestamp("effective_clock_in", { withTimezone: true, mode: 'date' }),
    effectiveClockOut: timestamp("effective_clock_out", { withTimezone: true, mode: 'date' }),

    // 3. Manager Verified (Final) - Validated by manager
    managerVerifiedIn: timestamp("manager_verified_in", { withTimezone: true, mode: 'date' }),
    managerVerifiedOut: timestamp("manager_verified_out", { withTimezone: true, mode: 'date' }),

    breakMinutes: integer("break_minutes").default(0),

    // -- Financial Snapshot (Budgeting) --
    budgetRateSnapshot: integer("budget_rate_snapshot"), // Was hourlyRateSnapshot
    payoutAmountCents: bigint("payout_amount_cents", { mode: 'number' }), // Renamed from estimatedCostCents (TICKET-001)
    totalDurationMinutes: integer("total_duration_minutes").default(0), // Added (TICKET-001)

    // -- Clock In Verification --
    clockInPosition: geography("clock_in_position"),
    clockInVerified: boolean("clock_in_verified").default(false),
    clockInMethod: text("clock_in_method"), // 'geofence' | 'manual_override'

    // -- Clock Out Verification --
    clockOutPosition: geography("clock_out_position"),
    clockOutVerified: boolean("clock_out_verified").default(false),
    clockOutMethod: text("clock_out_method"), // 'geofence' | 'manual_override' | 'left_geofence' | 'auto_flagged'

    // -- Review Workflow --
    needsReview: boolean("needs_review").default(false),
    reviewReason: text("review_reason"), // 'left_geofence' | 'no_clockout' | 'disputed' | 'late_arrival'

    // -- Last Known Position (for flagged shifts) --
    lastKnownPosition: geography("last_known_position"),
    lastKnownAt: timestamp("last_known_at", { withTimezone: true, mode: 'date' }),

    // -- Manager Audit Trail --
    adjustedBy: text("adjusted_by").references(() => user.id),
    adjustedAt: timestamp("adjusted_at", { withTimezone: true, mode: 'date' }),
    // adjustmentNotes REMOVED - Use assignment_audit_events

    // -- Worker Status --
    // Values: 'active', 'no_show', 'removed'
    status: text("status").notNull().default("active"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    assignmentShiftIdx: index("assignment_shift_idx").on(table.shiftId),
    assignmentWorkerIdx: index("assignment_worker_idx").on(table.workerId),
    assignmentStatusIdx: index("assignment_status_idx").on(table.status),
    // Constraint: A worker cannot be assigned to the same shift twice
    uniqueWorkerPerShift: unique("unique_worker_shift").on(table.shiftId, table.workerId)
}));

export const shiftRelations = relations(shift, ({ one, many }) => ({
    organization: one(organization, {
        fields: [shift.organizationId],
        references: [organization.id],
    }),
    location: one(location, {
        fields: [shift.locationId],
        references: [location.id],
    }),
    assignments: many(shiftAssignment),
}));

export const shiftAssignmentRelations = relations(shiftAssignment, ({ one }) => ({
    shift: one(shift, {
        fields: [shiftAssignment.shiftId],
        references: [shift.id],
    }),
    worker: one(user, {
        fields: [shiftAssignment.workerId],
        references: [user.id],
    }),
}));

// ============================================================================
// 5. GEOFENCE & TRACKING
// ============================================================================

export const workerLocation = pgTable("worker_location", {
    id: text("id").primaryKey(),

    // Relationships
    workerId: text("worker_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    shiftId: text("shift_id")
        .references(() => shift.id, { onDelete: "cascade" }), // nullable for pre-shift tracking
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),

    // GPS Data
    position: geography("position").notNull(),
    accuracyMeters: integer("accuracy_meters"), // GPS accuracy from device

    // Computed on insert
    venuePosition: geography("venue_position"), // Snapshot of venue coords
    distanceToVenueMeters: integer("distance_to_venue_meters"),
    isOnSite: boolean("is_on_site").default(false),

    // Event type
    eventType: text("event_type"), // 'ping' | 'arrival' | 'departure' | 'clock_in' | 'clock_out'

    // Timestamps
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    deviceTimestamp: timestamp("device_timestamp", { withTimezone: true, mode: 'date' }), // Time from device (may differ from server)
}, (table) => ({
    workerLocationWorkerIdx: index("worker_location_worker_idx").on(table.workerId),
    workerLocationShiftIdx: index("worker_location_shift_idx").on(table.shiftId),
    workerLocationTimeIdx: index("worker_location_time_idx").on(table.recordedAt),
    workerLocationOrgIdx: index("worker_location_org_idx").on(table.organizationId),
    workerLocationPosIdx: index("worker_location_pos_idx").using("gist", table.position) // GIST Index for PostGIS
}));

export const workerLocationRelations = relations(workerLocation, ({ one }) => ({
    worker: one(user, {
        fields: [workerLocation.workerId],
        references: [user.id],
    }),
    shift: one(shift, {
        fields: [workerLocation.shiftId],
        references: [shift.id],
    }),
    organization: one(organization, {
        fields: [workerLocation.organizationId],
        references: [organization.id],
    }),
}));

export const certificationRelations = relations(certification, ({ one }) => ({
    worker: one(user, {
        fields: [certification.workerId],
        references: [user.id],
    }),
}));

export const timeCorrectionRequest = pgTable("time_correction_request", {
    id: text("id").primaryKey(),

    // What's being corrected
    shiftAssignmentId: text("shift_assignment_id")
        .notNull()
        .references(() => shiftAssignment.id, { onDelete: "cascade" }),

    // Who's requesting
    workerId: text("worker_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),

    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),

    // Requested changes (all optional - only filled if requesting change)
    requestedClockIn: timestamp("requested_clock_in", { withTimezone: true, mode: 'date' }),
    requestedClockOut: timestamp("requested_clock_out", { withTimezone: true, mode: 'date' }),
    requestedBreakMinutes: integer("requested_break_minutes"),

    // Original values (snapshot for comparison)
    originalClockIn: timestamp("original_clock_in", { withTimezone: true, mode: 'date' }),
    originalClockOut: timestamp("original_clock_out", { withTimezone: true, mode: 'date' }),
    originalBreakMinutes: integer("original_break_minutes"),

    // Request details
    reason: text("reason").notNull(), // Worker's explanation

    // Status workflow
    status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'

    // Manager review
    reviewedBy: text("reviewed_by")
        .references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'date' }),
    reviewNotes: text("review_notes"), // Manager's notes on decision

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    correctionAssignmentIdx: index("correction_assignment_idx").on(table.shiftAssignmentId),
    correctionWorkerIdx: index("correction_worker_idx").on(table.workerId),
    correctionStatusIdx: index("correction_status_idx").on(table.status),
    correctionOrgIdx: index("correction_org_idx").on(table.organizationId),
}));

export const timeCorrectionRequestRelations = relations(timeCorrectionRequest, ({ one }) => ({
    shiftAssignment: one(shiftAssignment, {
        fields: [timeCorrectionRequest.shiftAssignmentId],
        references: [shiftAssignment.id],
    }),
    worker: one(user, {
        fields: [timeCorrectionRequest.workerId],
        references: [user.id],
    }),
    reviewer: one(user, {
        fields: [timeCorrectionRequest.reviewedBy],
        references: [user.id],
    }),
    organization: one(organization, {
        fields: [timeCorrectionRequest.organizationId],
        references: [organization.id],
    }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
    members: many(member),
    locations: many(location),
    invitations: many(invitation),
}));

// ============================================================================
// 6. AUDIT LOGGING
// ============================================================================

export const auditLog = pgTable("audit_log", {
    id: text("id").primaryKey(),

    // Context
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),

    // What
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),

    // Who
    actorId: text("actor_id"), // User who performed the action
    userName: text("user_name"), // Snapshot
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // Diff
    changes: json("changes").$type<{
        before: Record<string, any>;
        after: Record<string, any>;
    }>(),

    metadata: json("metadata").$type<Record<string, any>>(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    auditOrgIdx: index("audit_org_idx").on(table.organizationId),
    auditEntityIdx: index("audit_entity_idx").on(table.entityType, table.entityId),
    auditActorIdx: index("audit_actor_idx").on(table.actorId),
    auditActionIdx: index("audit_action_idx").on(table.action),
    auditTimeIdx: index("audit_time_idx").on(table.createdAt),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
    actor: one(user, {
        fields: [auditLog.actorId],
        references: [user.id],
    }),
    organization: one(organization, {
        fields: [auditLog.organizationId],
        references: [organization.id],
    }),
}));

// ============================================================================
// 7. INFRASTRUCTURE & SYSTEM
// ============================================================================

export const assignmentAuditEvent = pgTable("assignment_audit_events", {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id").notNull(), // No FK enforcement to allow keeping logs even if assignment is deleted (audit trail)
    actorId: text("actor_id").notNull(),
    previousStatus: text("previous_status"),
    newStatus: text("new_status").notNull(),
    metadata: jsonb("metadata").$type<Record<string, any>>(), // GPS, Device Info
    timestamp: timestamp("timestamp", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    auditAssignmentIdx: index("audit_assignment_idx").on(table.assignmentId),
    auditTimestampIdx: index("audit_timestamp_idx").on(table.timestamp),
}));

export const assignmentAuditEventRelations = relations(assignmentAuditEvent, ({ one }) => ({
    actor: one(user, {
        fields: [assignmentAuditEvent.actorId],
        references: [user.id],
    }),
}));

export const rateLimitState = pgTable("rate_limit_state", {
    key: text("key").primaryKey(), // e.g. "publish_schedule:{orgId}"
    count: integer("count").notNull().default(0),
    windowStart: decimal("window_start", { precision: 20, scale: 0 }).notNull(), // BigInt workaround for timestamps
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const idempotencyKey = pgTable("idempotency_key", {
    key: text("key").primaryKey(), // The client-provided key
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    hash: text("hash").notNull(), // Payload hash
    responseData: json("response_data"), // To cache the successful response
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'date' }).notNull(), // Cleanup policy
}, (table) => ({
    idempotencyOrgIdx: index("idempotency_org_idx").on(table.organizationId)
}));

export const workerAvailability = pgTable("worker_availability", {
    id: text("id").primaryKey(),
    workerId: text("worker_id").notNull().references(() => user.id, { onDelete: "cascade" }),

    // Time Range
    startTime: timestamp("start_time", { withTimezone: true, mode: 'date' }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true, mode: 'date' }).notNull(),

    // Type of Availability
    // 'unavailable': Blocked off (e.g. "I can't work")
    // 'preferred': "I want to work" (future feature)
    type: text("type").notNull().default("unavailable"),

    // Optional: Recurrence (if we want "Every Monday") - Keeping it simple for V1 (Flat dates)
    // reason: text("reason"), // e.g. "Doctor appt", "Class" - purely for worker reference

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    availWorkerIdx: index("avail_worker_idx").on(table.workerId),
    availTimeIdx: index("avail_time_idx").on(table.startTime, table.endTime)
}));

export const workerAvailabilityRelations = relations(workerAvailability, ({ one }) => ({
    worker: one(user, {
        fields: [workerAvailability.workerId],
        references: [user.id],
    }),
}));

// ============================================================================
// 8. NOTIFICATIONS & MOBILE
// ============================================================================

export const scheduledNotification = pgTable("scheduled_notifications", {
    id: text("id").primaryKey(),
    workerId: text("worker_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    shiftId: text("shift_id").references(() => shift.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),

    type: text("type").notNull(), // 'night_before' | '60_min' | '15_min' | 'shift_start' | 'late_warning'
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data").default({}),

    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: 'date' }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: 'date' }),
    status: text("status").notNull().default("pending"), // 'pending' | 'sent' | 'failed' | 'cancelled'

    attempts: integer("attempts").default(0),
    lastError: text("last_error"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => ({
    pendingQueueIdx: index("idx_notifications_pending_queue").on(table.scheduledAt, table.status),
    shiftIdx: index("idx_notifications_shift").on(table.shiftId),
    workerIdx: index("idx_notifications_worker").on(table.workerId),
    orgIdx: index("idx_notifications_org").on(table.organizationId),
}));

export const deviceToken = pgTable("device_tokens", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),

    pushToken: text("push_token").notNull(),
    platform: text("platform").notNull(), // 'ios' | 'android' | 'web'

    deviceName: text("device_name"),
    appVersion: text("app_version"),
    osVersion: text("os_version"),

    isActive: boolean("is_active").default(true),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'date' }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => ({
    userTokenUnique: uniqueIndex("idx_device_tokens_unique").on(table.userId, table.pushToken),
    activeUserIdx: index("idx_device_tokens_user").on(table.userId),
}));

export const workerNotificationPreferences = pgTable("worker_notification_preferences", {
    workerId: text("worker_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),

    nightBeforeEnabled: boolean("night_before_enabled").default(true),
    sixtyMinEnabled: boolean("sixty_min_enabled").default(true),
    fifteenMinEnabled: boolean("fifteen_min_enabled").default(true),
    shiftStartEnabled: boolean("shift_start_enabled").default(true),
    lateWarningEnabled: boolean("late_warning_enabled").default(true),
    geofenceAlertsEnabled: boolean("geofence_alerts_enabled").default(true),

    quietHoursEnabled: boolean("quiet_hours_enabled").default(false),
    quietHoursStart: time("quiet_hours_start"),
    quietHoursEnd: time("quiet_hours_end"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow(),
});

export const managerNotificationPreferences = pgTable("manager_notification_preferences", {
    managerId: text("manager_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),

    clockInAlertsEnabled: boolean("clock_in_alerts_enabled").default(true),
    clockOutAlertsEnabled: boolean("clock_out_alerts_enabled").default(true),

    // 'all' | 'booked_by_me' | 'onsite_contact'
    shiftScope: text("shift_scope").default("all").notNull(),

    // 'all' | 'selected'
    locationScope: text("location_scope").default("all").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow(),
});

// Relations
export const scheduledNotificationRelations = relations(scheduledNotification, ({ one }) => ({
    worker: one(user, { fields: [scheduledNotification.workerId], references: [user.id] }),
    shift: one(shift, { fields: [scheduledNotification.shiftId], references: [shift.id] }),
    organization: one(organization, { fields: [scheduledNotification.organizationId], references: [organization.id] }),
}));

export const deviceTokenRelations = relations(deviceToken, ({ one }) => ({
    user: one(user, { fields: [deviceToken.userId], references: [user.id] }),
}));

// ============================================================================
// 9. BILLING & SUBSCRIPTIONS
// ============================================================================

export const subscription = pgTable("subscription", {
    id: text("id").primaryKey(),
    plan: text("plan").notNull(),
    referenceId: text("reference_id").notNull(), // User ID or Org ID
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    status: text("status"),
    periodStart: timestamp("period_start", { withTimezone: true, mode: 'date' }),
    periodEnd: timestamp("period_end", { withTimezone: true, mode: 'date' }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end"),
    cancelAt: timestamp("cancel_at", { withTimezone: true, mode: 'date' }),
    canceledAt: timestamp("canceled_at", { withTimezone: true, mode: 'date' }),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: 'date' }),
    trialStart: timestamp("trial_start", { withTimezone: true, mode: 'date' }),
    trialEnd: timestamp("trial_end", { withTimezone: true, mode: 'date' }),
    seats: integer("seats"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});
