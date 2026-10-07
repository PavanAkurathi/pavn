// packages/database/src/schema.ts

import { pgTable, text, timestamp, boolean, index, json, integer, unique, decimal, customType, jsonb, time, uniqueIndex, bigint, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { jsonPositionToGeography } from "./spatial";

// We removed PostGIS customType due to Neon deployment bugs. Using jsonb for spatial data.

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
    role: text("role").default("admin"),
    timezone: text("timezone").default("UTC"), // NOTIF-004: Worker timezone for quiet hours

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
    activeOrganizationId: text("activeOrganizationId"), // Note: using camelCase for Better-Auth compatibility
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
    workers: many(worker),
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
    attendanceVerificationPolicy: text("attendance_verification_policy").notNull().default("strict_geofence"),

    // Scheduler setup. The onboarding "How you schedule" step fills these in;
    // until then an org gets the defaults below.
    weekStartsOn: integer("week_starts_on").notNull().default(0), // 0 = Sunday … 6 = Saturday
    openShiftClaimPolicy: text("open_shift_claim_policy").notNull().default("approval"), // 'approval' | 'auto'
    swapApprovalRequired: boolean("swap_approval_required").notNull().default(true),
    businessType: text("business_type"), // 'restaurant' | 'retail' | 'events' | 'other', null until answered
    scheduleStyle: text("schedule_style").notNull().default("steady"), // 'steady' | 'events': picks the default view
}, (table) => ({
    attendanceVerificationPolicyCheck: check(
        "check_attendance_verification_policy",
        sql`${table.attendanceVerificationPolicy} in ('strict_geofence', 'soft_geofence', 'none')`
    ),
    weekStartsOnCheck: check("check_week_starts_on", sql`${table.weekStartsOn} between 0 and 6`),
    openShiftClaimPolicyCheck: check(
        "check_open_shift_claim_policy",
        sql`${table.openShiftClaimPolicy} in ('approval', 'auto')`
    ),
    businessTypeCheck: check(
        "check_business_type",
        sql`${table.businessType} is null or ${table.businessType} in ('restaurant', 'retail', 'events', 'other')`
    ),
    scheduleStyleCheck: check("check_schedule_style", sql`${table.scheduleStyle} in ('steady', 'events')`),
}));

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
    position: jsonb("position").$type<{ lat: number, lng: number }>(),
    geofenceRadius: integer("geofence_radius").default(100),
    geocodedAt: timestamp("geocoded_at", { withTimezone: true, mode: 'date' }),
    geocodeSource: text("geocode_source"), // 'google' | 'manual' | 'mapbox'

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => ({
    locationOrgIdx: index("location_org_idx").on(table.organizationId),
    // GEO-002: position stores {lat, lng} in jsonb, so spatial queries index the derived geography expression.
    // NOT .concurrently(): drizzle-kit wraps every migration in a transaction and
    // CREATE INDEX CONCURRENTLY is illegal inside one, so `db:migrate` could never
    // apply this index. That is why migrations ended up being run by hand and the
    // journal fell out of sync. `location` is small (a handful of rows per org),
    // so a plain CREATE INDEX is fine; build it concurrently by hand if it ever
    // needs adding to a large live table.
    locationPosGistIdx: index("location_position_gist_idx")
        .using("gist", jsonPositionToGeography(table.position)),
    geofenceRadiusRangeCheck: check(
        "check_geofence_radius_range",
        sql`${table.geofenceRadius} >= 10 AND ${table.geofenceRadius} <= 500`
    )
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
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

/**
 * A person who works for one business. The business owns this record: the name,
 * phone, roles and notes are theirs, and the same person at two businesses is
 * two rows. Every shift assignment points here.
 *
 * `userId` stays null until the person signs in to the worker app with this
 * phone number, and for agency temps who never do. The phone number is the
 * only way in: a business has to add the worker (and invite them) first.
 */
export const worker = pgTable("worker", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
        .references(() => user.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    phoneNumber: text("phone_number"),
    email: text("email"),
    // 'staff' = the business's own people; 'agency' = temps supplied by an agency.
    employmentType: text("employment_type").notNull().default("staff"),
    agency: text("agency"),
    jobTitle: text("job_title"),
    roles: jsonb("roles").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    // Reference only (cents). Timesheets export hours; nothing computes pay from this.
    hourlyRate: integer("hourly_rate"),
    notes: text("notes"),
    // What the business hands the worker (in the invite text and link) to join.
    inviteCode: text("invite_code"),
    // 'added' (on the list, not invited) | 'invited' | 'active' (has signed in) | 'inactive'
    status: text("status").notNull().default("added"),
    invitedAt: timestamp("invited_at", { withTimezone: true, mode: 'date' }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    workerOrgIdx: index("worker_org_idx").on(table.organizationId),
    workerUserIdx: index("worker_user_idx").on(table.userId),
    workerOrgUserUnique: unique("worker_org_user_unique").on(table.organizationId, table.userId),
    // One worker per phone number per business.
    workerOrgPhoneUnique: uniqueIndex("worker_org_phone_unique")
        .on(table.organizationId, table.phoneNumber)
        .where(sql`${table.phoneNumber} is not null`),
    workerInviteCodeUnique: uniqueIndex("worker_invite_code_unique")
        .on(table.inviteCode)
        .where(sql`${table.inviteCode} is not null`),
    workerEmploymentTypeCheck: check(
        "check_worker_employment_type",
        sql`${table.employmentType} in ('staff', 'agency')`
    ),
}));

export const workerRelations = relations(worker, ({ one }) => ({
    organization: one(organization, {
        fields: [worker.organizationId],
        references: [organization.id],
    }),
    user: one(user, {
        fields: [worker.userId],
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

/**
 * An edit to a published shift that staff should not see yet. The scheduler
 * keeps the live columns as the last published version and stages changes
 * here until the week is published. Instants are ISO strings.
 */
export type ShiftPendingPatch = {
    startTime?: string;
    endTime?: string;
    title?: string;
    breakMinutes?: number;
    capacityTotal?: number;
    description?: string | null;
    eventId?: string | null;
    /** Remove the shift when the week is published. */
    cancel?: boolean;
};

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
    timezone: text("timezone"), // NOTIF-004: Shift-specific timezone (optional, falls back to location/org timezone)

    // -- Capacity --
    capacityTotal: integer("capacity_total").notNull().default(1),

    // -- Money (Stored in Cents) --
    price: integer("price").default(0), // Internal only — future marketplace


    // -- State --
    // Values: 'published', 'assigned', 'in-progress', 'completed', 'approved', 'cancelled'
    status: text("status").notNull().default("published"),

    // -- Grouping --
    scheduleGroupId: text("schedule_group_id"), // "int_..." for batched operations

    /**
     * Last-resort clock-in for a worker the geofence will not let through —
     * bad GPS, a site whose coordinates are slightly off, a steel warehouse.
     * Four digits the supervisor at the gate reads out.
     *
     * Scoped to one shift on purpose: a code overheard in a yard is useless
     * tomorrow. A clock-in through it is recorded as unverified and flagged for
     * review, so the convenience never costs the manager visibility.
     */
    siteCode: text("site_code"),
    siteCodeIssuedAt: timestamp("site_code_issued_at", { withTimezone: true, mode: 'date' }),

    // -- Scheduler --
    breakMinutes: integer("break_minutes").notNull().default(0), // planned unpaid break
    eventId: text("event_id").references(() => scheduleEvent.id, { onDelete: "set null" }),
    pendingPatch: jsonb("pending_patch").$type<ShiftPendingPatch>(),
    managerNote: text("manager_note"), // managers only; `description` is the note to staff
    publishedAt: timestamp("published_at", { withTimezone: true, mode: 'date' }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    shiftEventIdx: index("shift_event_idx").on(table.eventId),
    shiftOrgIdx: index("shift_org_idx").on(table.organizationId),
    shiftStatusIdx: index("shift_status_idx").on(table.status),
    shiftTimeIdx: index("shift_time_idx").on(table.startTime),
    // New Indexes (WH-006)
    shiftOrgStatusIdx: index("shift_org_status_idx").on(table.organizationId, table.status),
    shiftOrgTimeIdx: index("shift_org_time_idx").on(table.organizationId, table.startTime),
    shiftStatusTimeIdx: index("shift_status_time_idx").on(table.status, table.startTime).where(sql`status IN ('published', 'assigned', 'in-progress')`),
    shiftLocationIdx: index("shift_location_idx").on(table.locationId),
}));

/**
 * A shift shape worth keeping: the roles, the headcount, the hours, the place.
 *
 * Deliberately holds no dates and no people. A template that remembers who
 * worked it ages badly — someone leaves in March and is still being scheduled
 * in September, precisely when a manager is moving fast and not looking. So a
 * template lays out the work and staffing stays a separate, deliberate act.
 */
export const shiftTemplate = pgTable("shift_template", {
    id: text("id").primaryKey(),

    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),

    locationId: text("location_id")
        .notNull()
        .references(() => location.id, { onDelete: "cascade" }),

    name: text("name").notNull(),

    // Wall-clock times (HH:MM). Stored as local time, not an instant, because a
    // template says "we start at 6pm" — the date it lands on decides the rest,
    // and the location's timezone turns it into a real moment.
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),

    positions: jsonb("positions")
        .$type<{ roleName: string; headcount: number }[]>()
        .notNull()
        .default(sql`'[]'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    shiftTemplateOrgIdx: index("shift_template_org_idx").on(table.organizationId),
}));

export const shiftAssignment = pgTable("shift_assignment", {
    id: text("id").primaryKey(),

    // -- Relationships --
    shiftId: text("shift_id")
        .notNull()
        .references(() => shift.id, { onDelete: "cascade" }),

    // Who worked it. A worker clocks in through their own app account once they
    // have one (worker.userId); agency temps are tracked by the manager.
    workerId: text("worker_id")
        .notNull()
        .references(() => worker.id, { onDelete: "restrict" }),

    // -- Timesheet Data (Triple-Timestamp Model) --
    // 1. Actual (Behavioral) - Raw device timestamp
    actualClockIn: timestamp("actual_clock_in", { mode: 'date' }),
    actualClockOut: timestamp("actual_clock_out", { mode: 'date' }),

    // 2. Effective (Billable/Payable) - Rounded/Snapped
    effectiveClockIn: timestamp("effective_clock_in", { mode: 'date' }),
    effectiveClockOut: timestamp("effective_clock_out", { mode: 'date' }),

    // 3. Manager Verified (Final) - Validated by manager
    managerVerifiedIn: timestamp("manager_verified_in", { mode: 'date' }),
    managerVerifiedOut: timestamp("manager_verified_out", { mode: 'date' }),

    breakMinutes: integer("break_minutes").default(0),

    // -- Financial Snapshot (Budgeting) --
    budgetRateSnapshot: integer("budget_rate_snapshot"), // Was hourlyRateSnapshot
    payoutAmountCents: bigint("payout_amount_cents", { mode: 'number' }), // Renamed from estimatedCostCents (TICKET-001)
    totalDurationMinutes: integer("total_duration_minutes").default(0), // Added (TICKET-001)

    // -- Clock In Verification --
    clockInPosition: jsonb("clock_in_position").$type<{ lat: number, lng: number }>(),
    clockInVerified: boolean("clock_in_verified").default(false),
    clockInMethod: text("clock_in_method"), // 'geofence' | 'manual_override'

    // -- Clock Out Verification --
    clockOutPosition: jsonb("clock_out_position").$type<{ lat: number, lng: number }>(),
    clockOutVerified: boolean("clock_out_verified").default(false),
    clockOutMethod: text("clock_out_method"), // 'geofence' | 'manual_override' | 'left_geofence' | 'auto_flagged'

    // -- GPS Accuracy Metadata (GEO-001) --
    clockInAccuracy: decimal("clock_in_accuracy", { precision: 10, scale: 2 }), // GPS accuracy in meters
    clockInDistance: decimal("clock_in_distance", { precision: 10, scale: 2 }), // Distance from geofence center in meters
    clockInWarning: text("clock_in_warning"), // Warning message if accuracy is suboptimal
    clockOutAccuracy: decimal("clock_out_accuracy", { precision: 10, scale: 2 }), // GPS accuracy in meters
    clockOutDistance: decimal("clock_out_distance", { precision: 10, scale: 2 }), // Distance from geofence center in meters

    // -- Review Workflow --
    needsReview: boolean("needs_review").default(false),
    reviewReason: text("review_reason"), // 'left_geofence' | 'no_clockout' | 'disputed' | 'late_arrival'

    // -- Last Known Position (for flagged shifts) --
    lastKnownPosition: jsonb("last_known_position").$type<{ lat: number, lng: number }>(),
    lastKnownAt: timestamp("last_known_at", { withTimezone: true, mode: 'date' }),

    // -- Manager Audit Trail --
    adjustedBy: text("adjusted_by").references(() => user.id),
    adjustedAt: timestamp("adjusted_at", { withTimezone: true, mode: 'date' }),
    // adjustmentNotes REMOVED - Use assignment_audit_events

    // -- Worker Status --
    // Values: 'active', 'no_show', 'removed'
    status: text("status").notNull().default("active"),

    // Staged by the scheduler until the week is published. 'add' is not yet
    // visible to the worker; 'remove' still is. Null means live.
    pendingState: text("pending_state"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    pendingStateCheck: check(
        "check_assignment_pending_state",
        sql`${table.pendingState} is null or ${table.pendingState} in ('add', 'remove')`
    ),
    assignmentShiftIdx: index("assignment_shift_idx").on(table.shiftId),
    assignmentWorkerIdx: index("assignment_worker_idx").on(table.workerId),
    assignmentStatusIdx: index("assignment_status_idx").on(table.status),
    // Constraint: A worker cannot be assigned to the same shift twice
    uniqueWorkerPerShift: unique("unique_worker_shift").on(table.shiftId, table.workerId),
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
    event: one(scheduleEvent, {
        fields: [shift.eventId],
        references: [scheduleEvent.id],
    }),
    assignments: many(shiftAssignment),
}));

export const shiftTemplateRelations = relations(shiftTemplate, ({ one }) => ({
    organization: one(organization, {
        fields: [shiftTemplate.organizationId],
        references: [organization.id],
    }),
    location: one(location, {
        fields: [shiftTemplate.locationId],
        references: [location.id],
    }),
}));

export const shiftAssignmentRelations = relations(shiftAssignment, ({ one }) => ({
    shift: one(shift, {
        fields: [shiftAssignment.shiftId],
        references: [shift.id],
    }),
    worker: one(worker, {
        fields: [shiftAssignment.workerId],
        references: [worker.id],
    }),
}));

// ============================================================================
// 4b. SCHEDULER (departments, events, requests)
// ============================================================================

/**
 * A group of roles scheduled together, e.g. Kitchen = Line cook, Prep,
 * Dishwasher. People belong through their roles, so nobody is added to a
 * department by hand. Seeded from the business type chosen at onboarding.
 */
export const department = pgTable("department", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Canonical role names (see canonicalizeWorkerRole).
    roles: jsonb("roles").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    departmentOrgIdx: index("department_org_idx").on(table.organizationId),
    departmentOrgName: unique("department_org_name").on(table.organizationId, table.name),
}));

/**
 * A one-off with its own headcount per role, e.g. a wedding. Its shifts point
 * back here through `shift.event_id`, one shift per role.
 */
export const scheduleEvent = pgTable("schedule_event", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),
    locationId: text("location_id")
        .notNull()
        .references(() => location.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startTime: timestamp("start_time", { withTimezone: true, mode: 'date' }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true, mode: 'date' }).notNull(),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    scheduleEventOrgIdx: index("schedule_event_org_idx").on(table.organizationId),
    scheduleEventLocationTimeIdx: index("schedule_event_location_time_idx").on(table.locationId, table.startTime),
    scheduleEventTimeCheck: check("check_schedule_event_time", sql`${table.endTime} > ${table.startTime}`),
}));

/**
 * A worker asking to change their part in a shift, from the mobile app:
 * claim an open slot, drop a shift, or hand it to a coworker (swap).
 * A swap waits on the coworker first (`pending_peer`), then the manager.
 */
export const shiftRequest = pgTable("shift_request", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'claim' | 'drop' | 'swap'
    shiftId: text("shift_id")
        .notNull()
        .references(() => shift.id, { onDelete: "cascade" }),
    requesterWorkerId: text("requester_worker_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    // Swap only: the coworker who would take the shift.
    targetWorkerId: text("target_worker_id").references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending_manager"),
    note: text("note"),
    decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'date' }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    shiftRequestOrgStatusIdx: index("shift_request_org_status_idx").on(table.organizationId, table.status),
    shiftRequestShiftIdx: index("shift_request_shift_idx").on(table.shiftId),
    // One open request per person, shift and kind; a decided one can be retried.
    shiftRequestOneOpen: uniqueIndex("shift_request_one_open_idx")
        .on(table.shiftId, table.requesterWorkerId, table.type)
        .where(sql`status in ('pending_peer', 'pending_manager')`),
    shiftRequestTypeCheck: check("check_shift_request_type", sql`${table.type} in ('claim', 'drop', 'swap')`),
    shiftRequestStatusCheck: check(
        "check_shift_request_status",
        sql`${table.status} in ('pending_peer', 'pending_manager', 'approved', 'declined', 'cancelled', 'expired')`
    ),
}));

/**
 * Time off a worker asks for, which a manager approves or declines. Approved
 * time off blocks scheduling; `worker_availability` stays the worker's own,
 * softer "I'd rather not" windows.
 */
export const timeOffRequest = pgTable("time_off_request", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),
    workerId: text("worker_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    startTime: timestamp("start_time", { withTimezone: true, mode: 'date' }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true, mode: 'date' }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    reason: text("reason"),
    status: text("status").notNull().default("pending"),
    decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'date' }),
    managerNote: text("manager_note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
    timeOffOrgStatusIdx: index("time_off_org_status_idx").on(table.organizationId, table.status),
    timeOffWorkerTimeIdx: index("time_off_worker_time_idx").on(table.workerId, table.startTime),
    timeOffStatusCheck: check(
        "check_time_off_status",
        sql`${table.status} in ('pending', 'approved', 'declined', 'cancelled')`
    ),
    timeOffTimeCheck: check("check_time_off_time", sql`${table.endTime} > ${table.startTime}`),
}));

export const departmentRelations = relations(department, ({ one }) => ({
    organization: one(organization, {
        fields: [department.organizationId],
        references: [organization.id],
    }),
}));

export const scheduleEventRelations = relations(scheduleEvent, ({ one, many }) => ({
    organization: one(organization, {
        fields: [scheduleEvent.organizationId],
        references: [organization.id],
    }),
    location: one(location, {
        fields: [scheduleEvent.locationId],
        references: [location.id],
    }),
    shifts: many(shift),
}));

export const shiftRequestRelations = relations(shiftRequest, ({ one }) => ({
    organization: one(organization, {
        fields: [shiftRequest.organizationId],
        references: [organization.id],
    }),
    shift: one(shift, {
        fields: [shiftRequest.shiftId],
        references: [shift.id],
    }),
    requester: one(user, {
        fields: [shiftRequest.requesterWorkerId],
        references: [user.id],
        relationName: "shift_request_requester",
    }),
    target: one(user, {
        fields: [shiftRequest.targetWorkerId],
        references: [user.id],
        relationName: "shift_request_target",
    }),
}));

export const timeOffRequestRelations = relations(timeOffRequest, ({ one }) => ({
    organization: one(organization, {
        fields: [timeOffRequest.organizationId],
        references: [organization.id],
    }),
    worker: one(user, {
        fields: [timeOffRequest.workerId],
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
    position: jsonb("position").$type<{ lat: number, lng: number }>().notNull(),
    accuracyMeters: integer("accuracy_meters"), // GPS accuracy from device

    // Computed on insert
    venuePosition: jsonb("venue_position").$type<{ lat: number, lng: number }>(), // Snapshot of venue coords
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
    workerLocationPosIdx: index("worker_location_pos_idx").on(table.position) // Switched from GIST for Neon
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
    // [TENANT-001] Organization scope — prevents cross-tenant availability leaks
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),

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
    availTimeIdx: index("avail_time_idx").on(table.startTime, table.endTime),
    availOrgIdx: index("avail_org_idx").on(table.organizationId),
}));

export const workerAvailabilityRelations = relations(workerAvailability, ({ one }) => ({
    worker: one(user, {
        fields: [workerAvailability.workerId],
        references: [user.id],
    }),
    organization: one(organization, {
        fields: [workerAvailability.organizationId],
        references: [organization.id],
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
