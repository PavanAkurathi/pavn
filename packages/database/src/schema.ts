// packages/database/src/schema.ts

import { pgTable, text, timestamp, boolean, index, json, integer, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
}, (table) => ({
    userEmailIdx: index("user_email_idx").on(table.email)
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
    createdAt: timestamp("created_at").notNull(),
}, (table) => ({
    memberOrgIdx: index("member_org_idx").on(table.organizationId),
    memberUserIdx: index("member_user_idx").on(table.userId)
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

    // -- Details --
    title: text("title").notNull(), // e.g. "Event Security"
    description: text("description"),

    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),

    // -- Capacity --
    capacityTotal: integer("capacity_total").notNull().default(1),

    // -- Money (Stored in Cents) --
    price: integer("price").notNull(), // $20.00 = 2000
    currency: text("currency").default("USD").notNull(),

    // -- State --
    // Values: 'published', 'assigned', 'in-progress', 'completed', 'approved', 'cancelled'
    status: text("status").notNull().default("published"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    shiftOrgIdx: index("shift_org_idx").on(table.organizationId),
    shiftStatusIdx: index("shift_status_idx").on(table.status),
    shiftTimeIdx: index("shift_time_idx").on(table.startTime),
}));

export const shiftAssignment = pgTable("shift_assignment", {
    id: text("id").primaryKey(),

    // -- Relationships --
    shiftId: text("shift_id")
        .notNull()
        .references(() => shift.id, { onDelete: "cascade" }),

    workerId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),

    // -- Timesheet Data (The "Actuals") --
    clockIn: timestamp("clock_in"),
    clockOut: timestamp("clock_out"),
    breakMinutes: integer("break_minutes").default(0),

    // -- Financial Snapshot --
    hourlyRateSnapshot: integer("hourly_rate_snapshot"),
    grossPayCents: integer("gross_pay_cents").default(0),

    // -- Worker Status --
    // Values: 'active', 'no_show', 'removed'
    status: text("status").notNull().default("active"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    assignmentShiftIdx: index("assignment_shift_idx").on(table.shiftId),
    assignmentWorkerIdx: index("assignment_worker_idx").on(table.workerId),
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
