// packages/database/src/schema.ts

import { pgTable, text, timestamp, boolean, index, json } from "drizzle-orm/pg-core";

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
    // password: text("password"), // REMOVED: Stored in account table
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
