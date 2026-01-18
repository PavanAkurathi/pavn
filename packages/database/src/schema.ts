// packages/database/src/schema.ts

import { pgTable, text, timestamp, boolean, index, json, integer, unique, decimal } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

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

    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
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
    expiresAt: timestamp("expires_at"),
    status: text("status").default("valid"), // 'valid', 'expired'
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
    expiresAt: timestamp("expires_at"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
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
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
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
    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    subscriptionStatus: text("subscription_status").default("inactive"),
    currentPeriodEnd: timestamp("current_period_end"),
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
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    geofenceRadius: integer("geofence_radius").default(100),
    geocodedAt: timestamp("geocoded_at"),
    geocodeSource: text("geocode_source"), // 'google' | 'manual' | 'mapbox'

    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
}, (table) => ({
    locationOrgIdx: index("location_org_idx").on(table.organizationId)
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
    role: text("role").notNull(), // "admin" | "member" (Text is safer than Enum for libraries)
    hourlyRate: integer("hourly_rate"), // Stored in cents, nullable
    jobTitle: text("job_title"), // e.g. "Security Guard", nullable
    createdAt: timestamp("created_at").notNull(),
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
    expiresAt: timestamp("expires_at").notNull(),
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

    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),

    // -- Capacity --
    capacityTotal: integer("capacity_total").notNull().default(1),

    // -- Money (Stored in Cents) --
    price: integer("price").notNull(), // $20.00 = 2000


    // -- State --
    // Values: 'published', 'assigned', 'in-progress', 'completed', 'approved', 'cancelled'
    status: text("status").notNull().default("published"),

    // -- Grouping --
    scheduleGroupId: text("schedule_group_id"), // "int_..." for batched operations

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    shiftOrgIdx: index("shift_org_idx").on(table.organizationId),
    shiftStatusIdx: index("shift_status_idx").on(table.status),
    shiftTimeIdx: index("shift_time_idx").on(table.startTime),
    // New Indexes (WH-006)
    shiftOrgStatusIdx: index("shift_org_status_idx").on(table.organizationId, table.status),
    shiftOrgTimeIdx: index("shift_org_time_idx").on(table.organizationId, table.startTime),
    shiftStatusTimeIdx: index("shift_status_time_idx").on(table.status, table.startTime).where(sql`status IN ('published', 'assigned', 'in-progress')`),
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

    // -- Timesheet Data (The "Actuals") --
    clockIn: timestamp("clock_in"),
    clockOut: timestamp("clock_out"),
    breakMinutes: integer("break_minutes").default(0),

    // -- Financial Snapshot --
    hourlyRateSnapshot: integer("hourly_rate_snapshot"),
    grossPayCents: integer("gross_pay_cents").default(0),

    // -- Clock In Verification --
    clockInLatitude: decimal("clock_in_latitude", { precision: 10, scale: 8 }),
    clockInLongitude: decimal("clock_in_longitude", { precision: 11, scale: 8 }),
    clockInVerified: boolean("clock_in_verified").default(false),
    clockInMethod: text("clock_in_method"), // 'geofence' | 'manual_override'

    // -- Clock Out Verification --
    clockOutLatitude: decimal("clock_out_latitude", { precision: 10, scale: 8 }),
    clockOutLongitude: decimal("clock_out_longitude", { precision: 11, scale: 8 }),
    clockOutVerified: boolean("clock_out_verified").default(false),
    clockOutMethod: text("clock_out_method"), // 'geofence' | 'manual_override' | 'left_geofence' | 'auto_flagged'

    // -- Review Workflow --
    needsReview: boolean("needs_review").default(false),
    reviewReason: text("review_reason"), // 'left_geofence' | 'no_clockout' | 'disputed' | 'late_arrival'

    // -- Last Known Position (for flagged shifts) --
    lastKnownLatitude: decimal("last_known_latitude", { precision: 10, scale: 8 }),
    lastKnownLongitude: decimal("last_known_longitude", { precision: 11, scale: 8 }),
    lastKnownAt: timestamp("last_known_at"),

    // -- Manager Audit Trail --
    adjustedBy: text("adjusted_by").references(() => user.id),
    adjustedAt: timestamp("adjusted_at"),
    adjustmentNotes: text("adjustment_notes"),

    // -- Worker Status --
    // Values: 'active', 'no_show', 'removed'
    status: text("status").notNull().default("active"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
    latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
    longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
    accuracyMeters: integer("accuracy_meters"), // GPS accuracy from device

    // Computed on insert
    venueLatitude: decimal("venue_latitude", { precision: 10, scale: 8 }), // Snapshot of venue coords
    venueLongitude: decimal("venue_longitude", { precision: 11, scale: 8 }),
    distanceToVenueMeters: integer("distance_to_venue_meters"),
    isOnSite: boolean("is_on_site").default(false),

    // Event type
    eventType: text("event_type"), // 'ping' | 'arrival' | 'departure' | 'clock_in' | 'clock_out'

    // Timestamps
    recordedAt: timestamp("recorded_at").notNull().defaultNow(),
    deviceTimestamp: timestamp("device_timestamp"), // Time from device (may differ from server)
}, (table) => ({
    workerLocationWorkerIdx: index("worker_location_worker_idx").on(table.workerId),
    workerLocationShiftIdx: index("worker_location_shift_idx").on(table.shiftId),
    workerLocationTimeIdx: index("worker_location_time_idx").on(table.recordedAt),
    workerLocationOrgIdx: index("worker_location_org_idx").on(table.organizationId),
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
    requestedClockIn: timestamp("requested_clock_in"),
    requestedClockOut: timestamp("requested_clock_out"),
    requestedBreakMinutes: integer("requested_break_minutes"),

    // Original values (snapshot for comparison)
    originalClockIn: timestamp("original_clock_in"),
    originalClockOut: timestamp("original_clock_out"),
    originalBreakMinutes: integer("original_break_minutes"),

    // Request details
    reason: text("reason").notNull(), // Worker's explanation

    // Status workflow
    status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'

    // Manager review
    reviewedBy: text("reviewed_by")
        .references(() => user.id),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"), // Manager's notes on decision

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
    action: text("action").notNull(), // e.g., 'shift.approved', 'assignment.clock_out'
    entityType: text("entity_type").notNull(), // e.g., 'shift', 'shift_assignment'
    entityId: text("entity_id").notNull(),
    actorId: text("actor_id"), // User who performed the action (nullable for system actions)
    organizationId: text("organization_id").notNull(),
    metadata: json("metadata"), // JSON blob for extra details (e.g. diffs, reasons)
    createdAt: timestamp("created_at").notNull().defaultNow(),
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
