CREATE EXTENSION IF NOT EXISTS postgis;
--
-- PostgreSQL database dump
--

\restrict Yw1nqBggGQjI32kWyL6SCPKR1DMfOWrrntL1bpguuE36DvHpjkGg4RL4nMOJzFB

-- Dumped from database version 17.8 (6108b59)
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id text NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id text NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    expires_at timestamp with time zone,
    password text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: assignment_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment_audit_events (
    id text NOT NULL,
    assignment_id text NOT NULL,
    actor_id text NOT NULL,
    previous_status text,
    new_status text NOT NULL,
    metadata jsonb,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id text NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    actor_id text,
    organization_id text NOT NULL,
    metadata json,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_name text,
    ip_address text,
    user_agent text,
    changes json
);


--
-- Name: certification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certification (
    id text NOT NULL,
    worker_id text NOT NULL,
    name text NOT NULL,
    issuer text,
    expires_at timestamp with time zone,
    status text DEFAULT 'valid'::text,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: device_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    push_token text NOT NULL,
    platform text NOT NULL,
    device_name text,
    app_version text,
    os_version text,
    is_active boolean DEFAULT true,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: idempotency_key; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_key (
    key text NOT NULL,
    organization_id text NOT NULL,
    hash text NOT NULL,
    response_data json,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: invitation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitation (
    id text NOT NULL,
    organization_id text NOT NULL,
    email text NOT NULL,
    role text,
    status text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    inviter_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: location; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location (
    id text NOT NULL,
    organization_id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    address text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    parking text DEFAULT 'free'::text,
    specifics json,
    instructions text,
    zip text,
    geofence_radius integer DEFAULT 100,
    geocoded_at timestamp with time zone,
    geocode_source text,
    "position" public.geography(Point,4326)
);


--
-- Name: manager_notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manager_notification_preferences (
    manager_id text NOT NULL,
    clock_in_alerts_enabled boolean DEFAULT true,
    clock_out_alerts_enabled boolean DEFAULT true,
    shift_scope text DEFAULT 'all'::text NOT NULL,
    location_scope text DEFAULT 'all'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member (
    id text NOT NULL,
    organization_id text NOT NULL,
    user_id text NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    hourly_rate integer,
    job_title text,
    status text DEFAULT 'active'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization (
    id text NOT NULL,
    name text NOT NULL,
    slug text,
    logo text,
    created_at timestamp with time zone NOT NULL,
    metadata text,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'inactive'::text,
    current_period_end timestamp with time zone,
    early_clock_in_buffer_minutes integer DEFAULT 60 NOT NULL,
    currency_code text DEFAULT 'USD'::text NOT NULL,
    timezone text DEFAULT 'America/New_York'::text NOT NULL,
    break_threshold_minutes integer,
    regional_overtime_policy text DEFAULT 'weekly_40'::text NOT NULL
);


--
-- Name: rate_limit_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_state (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    window_start numeric(20,0) NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roster_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roster_entry (
    id text NOT NULL,
    organization_id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone_number text,
    role text DEFAULT 'member'::text,
    hourly_rate integer,
    job_title text,
    status text DEFAULT 'uninvited'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: scheduled_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_notifications (
    id text NOT NULL,
    worker_id text NOT NULL,
    shift_id text,
    organization_id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    scheduled_at timestamp with time zone NOT NULL,
    sent_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0,
    last_error text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    id text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    ip_address text,
    user_agent text,
    user_id text NOT NULL,
    active_organization_id text
);


--
-- Name: shift; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift (
    id text NOT NULL,
    organization_id text NOT NULL,
    location_id text,
    title text NOT NULL,
    description text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    capacity_total integer DEFAULT 1 NOT NULL,
    price integer DEFAULT 0,
    status text DEFAULT 'published'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_id text,
    schedule_group_id text
);


--
-- Name: shift_assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_assignment (
    id text NOT NULL,
    shift_id text NOT NULL,
    worker_id text NOT NULL,
    actual_clock_in timestamp without time zone,
    actual_clock_out timestamp with time zone,
    break_minutes integer DEFAULT 0,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    budget_rate_snapshot integer,
    payout_amount_cents bigint,
    clock_in_verified boolean DEFAULT false,
    clock_in_method text,
    clock_out_verified boolean DEFAULT false,
    clock_out_method text,
    needs_review boolean DEFAULT false,
    review_reason text,
    last_known_at timestamp with time zone,
    adjusted_by text,
    adjusted_at timestamp with time zone,
    clock_in_position public.geography(Point,4326),
    clock_out_position public.geography(Point,4326),
    last_known_position public.geography(Point,4326),
    effective_clock_in timestamp with time zone,
    effective_clock_out timestamp with time zone,
    manager_verified_in timestamp with time zone,
    manager_verified_out timestamp with time zone,
    total_duration_minutes integer DEFAULT 0
);


--
-- Name: subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription (
    id text NOT NULL,
    plan text NOT NULL,
    reference_id text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    status text,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    cancel_at_period_end boolean,
    cancel_at timestamp with time zone,
    canceled_at timestamp with time zone,
    ended_at timestamp with time zone,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    seats integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: time_correction_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_correction_request (
    id text NOT NULL,
    shift_assignment_id text NOT NULL,
    worker_id text NOT NULL,
    organization_id text NOT NULL,
    requested_clock_in timestamp with time zone,
    requested_clock_out timestamp with time zone,
    requested_break_minutes integer,
    original_clock_in timestamp with time zone,
    original_clock_out timestamp with time zone,
    original_break_minutes integer,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    email_verified boolean NOT NULL,
    image text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    phone_number text,
    emergency_contact json,
    address json,
    stripe_customer_id text
);


--
-- Name: verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: worker_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_availability (
    id text NOT NULL,
    worker_id text NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    type text DEFAULT 'unavailable'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: worker_location; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_location (
    id text NOT NULL,
    worker_id text NOT NULL,
    shift_id text,
    organization_id text NOT NULL,
    accuracy_meters integer,
    distance_to_venue_meters integer,
    is_on_site boolean DEFAULT false,
    event_type text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    device_timestamp timestamp with time zone,
    "position" public.geography(Point,4326) NOT NULL,
    venue_position public.geography(Point,4326)
);


--
-- Name: worker_notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_notification_preferences (
    worker_id text NOT NULL,
    night_before_enabled boolean DEFAULT true,
    sixty_min_enabled boolean DEFAULT true,
    fifteen_min_enabled boolean DEFAULT true,
    shift_start_enabled boolean DEFAULT true,
    late_warning_enabled boolean DEFAULT true,
    geofence_alerts_enabled boolean DEFAULT true,
    quiet_hours_enabled boolean DEFAULT false,
    quiet_hours_start time without time zone,
    quiet_hours_end time without time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: worker_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_role (
    id text NOT NULL,
    worker_id text NOT NULL,
    organization_id text NOT NULL,
    role text NOT NULL,
    hourly_rate integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: assignment_audit_events assignment_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_audit_events
    ADD CONSTRAINT assignment_audit_events_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: certification certification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification
    ADD CONSTRAINT certification_pkey PRIMARY KEY (id);


--
-- Name: device_tokens device_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);


--
-- Name: idempotency_key idempotency_key_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_key
    ADD CONSTRAINT idempotency_key_pkey PRIMARY KEY (key);


--
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
-- Name: location location_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location
    ADD CONSTRAINT location_pkey PRIMARY KEY (id);


--
-- Name: manager_notification_preferences manager_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager_notification_preferences
    ADD CONSTRAINT manager_notification_preferences_pkey PRIMARY KEY (manager_id);


--
-- Name: member member_org_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_org_user_unique UNIQUE (organization_id, user_id);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: organization organization_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_slug_unique UNIQUE (slug);


--
-- Name: rate_limit_state rate_limit_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_state
    ADD CONSTRAINT rate_limit_state_pkey PRIMARY KEY (key);


--
-- Name: roster_entry roster_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_entry
    ADD CONSTRAINT roster_entry_pkey PRIMARY KEY (id);


--
-- Name: scheduled_notifications scheduled_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_token_unique UNIQUE (token);


--
-- Name: shift_assignment shift_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_assignment
    ADD CONSTRAINT shift_assignment_pkey PRIMARY KEY (id);


--
-- Name: shift shift_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift
    ADD CONSTRAINT shift_pkey PRIMARY KEY (id);


--
-- Name: subscription subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_pkey PRIMARY KEY (id);


--
-- Name: time_correction_request time_correction_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_correction_request
    ADD CONSTRAINT time_correction_request_pkey PRIMARY KEY (id);


--
-- Name: shift_assignment unique_worker_shift; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_assignment
    ADD CONSTRAINT unique_worker_shift UNIQUE (shift_id, worker_id);


--
-- Name: user user_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_unique UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: worker_availability worker_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_availability
    ADD CONSTRAINT worker_availability_pkey PRIMARY KEY (id);


--
-- Name: worker_location worker_location_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_location
    ADD CONSTRAINT worker_location_pkey PRIMARY KEY (id);


--
-- Name: worker_notification_preferences worker_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_notification_preferences
    ADD CONSTRAINT worker_notification_preferences_pkey PRIMARY KEY (worker_id);


--
-- Name: worker_role worker_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_role
    ADD CONSTRAINT worker_role_pkey PRIMARY KEY (id);


--
-- Name: account_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_provider_idx ON public.account USING btree (provider_id, account_id);


--
-- Name: account_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_user_idx ON public.account USING btree (user_id);


--
-- Name: assignment_shift_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignment_shift_idx ON public.shift_assignment USING btree (shift_id);


--
-- Name: assignment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignment_status_idx ON public.shift_assignment USING btree (status);


--
-- Name: assignment_worker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignment_worker_idx ON public.shift_assignment USING btree (worker_id);


--
-- Name: audit_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_action_idx ON public.audit_log USING btree (action);


--
-- Name: audit_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_actor_idx ON public.audit_log USING btree (actor_id);


--
-- Name: audit_assignment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_assignment_idx ON public.assignment_audit_events USING btree (assignment_id);


--
-- Name: audit_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_entity_idx ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: audit_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_org_idx ON public.audit_log USING btree (organization_id);


--
-- Name: audit_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_time_idx ON public.audit_log USING btree (created_at);


--
-- Name: audit_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_timestamp_idx ON public.assignment_audit_events USING btree ("timestamp");


--
-- Name: avail_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX avail_time_idx ON public.worker_availability USING btree (start_time, end_time);


--
-- Name: avail_worker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX avail_worker_idx ON public.worker_availability USING btree (worker_id);


--
-- Name: cert_worker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cert_worker_idx ON public.certification USING btree (worker_id);


--
-- Name: correction_assignment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX correction_assignment_idx ON public.time_correction_request USING btree (shift_assignment_id);


--
-- Name: correction_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX correction_org_idx ON public.time_correction_request USING btree (organization_id);


--
-- Name: correction_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX correction_status_idx ON public.time_correction_request USING btree (status);


--
-- Name: correction_worker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX correction_worker_idx ON public.time_correction_request USING btree (worker_id);


--
-- Name: idempotency_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idempotency_org_idx ON public.idempotency_key USING btree (organization_id);


--
-- Name: idx_device_tokens_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_device_tokens_unique ON public.device_tokens USING btree (user_id, push_token);


--
-- Name: idx_device_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_tokens_user ON public.device_tokens USING btree (user_id);


--
-- Name: idx_notifications_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_org ON public.scheduled_notifications USING btree (organization_id);


--
-- Name: idx_notifications_pending_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_pending_queue ON public.scheduled_notifications USING btree (scheduled_at, status);


--
-- Name: idx_notifications_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_shift ON public.scheduled_notifications USING btree (shift_id);


--
-- Name: idx_notifications_worker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_worker ON public.scheduled_notifications USING btree (worker_id);


--
-- Name: location_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX location_org_idx ON public.location USING btree (organization_id);


--
-- Name: location_pos_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX location_pos_idx ON public.location USING gist ("position");


--
-- Name: member_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX member_org_idx ON public.member USING btree (organization_id);


--
-- Name: member_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX member_user_idx ON public.member USING btree (user_id);


--
-- Name: session_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX session_user_idx ON public.session USING btree (user_id);


--
-- Name: shift_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_location_idx ON public.shift USING btree (location_id);


--
-- Name: shift_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_org_idx ON public.shift USING btree (organization_id);


--
-- Name: shift_org_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_org_status_idx ON public.shift USING btree (organization_id, status);


--
-- Name: shift_org_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_org_time_idx ON public.shift USING btree (organization_id, start_time);


--
-- Name: shift_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_status_idx ON public.shift USING btree (status);


--
-- Name: shift_status_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_status_time_idx ON public.shift USING btree (status, start_time) WHERE (status = ANY (ARRAY['published'::text, 'assigned'::text, 'in-progress'::text]));


--
-- Name: shift_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_time_idx ON public.shift USING btree (start_time);


--
-- Name: user_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_email_idx ON public."user" USING btree (email);


--
-- Name: worker_location_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX worker_location_org_idx ON public.worker_location USING btree (organization_id);


--
-- Name: worker_location_pos_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX worker_location_pos_idx ON public.worker_location USING gist ("position");


--
-- Name: worker_location_shift_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX worker_location_shift_idx ON public.worker_location USING btree (shift_id);


--
-- Name: worker_location_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX worker_location_time_idx ON public.worker_location USING btree (recorded_at);


--
-- Name: worker_location_worker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX worker_location_worker_idx ON public.worker_location USING btree (worker_id);


--
-- Name: worker_role_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX worker_role_org_idx ON public.worker_role USING btree (organization_id);


--
-- Name: worker_role_worker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX worker_role_worker_idx ON public.worker_role USING btree (worker_id);


--
-- Name: account account_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: certification certification_worker_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification
    ADD CONSTRAINT certification_worker_id_user_id_fk FOREIGN KEY (worker_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: device_tokens device_tokens_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: idempotency_key idempotency_key_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_key
    ADD CONSTRAINT idempotency_key_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_inviter_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT invitation_inviter_id_user_id_fk FOREIGN KEY (inviter_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT invitation_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: location location_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location
    ADD CONSTRAINT location_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: manager_notification_preferences manager_notification_preferences_manager_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager_notification_preferences
    ADD CONSTRAINT manager_notification_preferences_manager_id_user_id_fk FOREIGN KEY (manager_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: member member_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: member member_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: roster_entry roster_entry_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_entry
    ADD CONSTRAINT roster_entry_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: scheduled_notifications scheduled_notifications_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: scheduled_notifications scheduled_notifications_shift_id_shift_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_shift_id_shift_id_fk FOREIGN KEY (shift_id) REFERENCES public.shift(id) ON DELETE CASCADE;


--
-- Name: scheduled_notifications scheduled_notifications_worker_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_worker_id_user_id_fk FOREIGN KEY (worker_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: session session_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: shift_assignment shift_assignment_adjusted_by_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_assignment
    ADD CONSTRAINT shift_assignment_adjusted_by_user_id_fk FOREIGN KEY (adjusted_by) REFERENCES public."user"(id);


--
-- Name: shift_assignment shift_assignment_shift_id_shift_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_assignment
    ADD CONSTRAINT shift_assignment_shift_id_shift_id_fk FOREIGN KEY (shift_id) REFERENCES public.shift(id) ON DELETE CASCADE;


--
-- Name: shift_assignment shift_assignment_worker_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_assignment
    ADD CONSTRAINT shift_assignment_worker_id_user_id_fk FOREIGN KEY (worker_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: shift shift_contact_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift
    ADD CONSTRAINT shift_contact_id_user_id_fk FOREIGN KEY (contact_id) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: shift shift_location_id_location_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift
    ADD CONSTRAINT shift_location_id_location_id_fk FOREIGN KEY (location_id) REFERENCES public.location(id) ON DELETE SET NULL;


--
-- Name: shift shift_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift
    ADD CONSTRAINT shift_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: time_correction_request time_correction_request_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_correction_request
    ADD CONSTRAINT time_correction_request_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: time_correction_request time_correction_request_reviewed_by_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_correction_request
    ADD CONSTRAINT time_correction_request_reviewed_by_user_id_fk FOREIGN KEY (reviewed_by) REFERENCES public."user"(id);


--
-- Name: time_correction_request time_correction_request_shift_assignment_id_shift_assignment_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_correction_request
    ADD CONSTRAINT time_correction_request_shift_assignment_id_shift_assignment_id FOREIGN KEY (shift_assignment_id) REFERENCES public.shift_assignment(id) ON DELETE CASCADE;


--
-- Name: time_correction_request time_correction_request_worker_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_correction_request
    ADD CONSTRAINT time_correction_request_worker_id_user_id_fk FOREIGN KEY (worker_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: worker_availability worker_availability_worker_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_availability
    ADD CONSTRAINT worker_availability_worker_id_user_id_fk FOREIGN KEY (worker_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: worker_location worker_location_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_location
    ADD CONSTRAINT worker_location_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: worker_location worker_location_shift_id_shift_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_location
    ADD CONSTRAINT worker_location_shift_id_shift_id_fk FOREIGN KEY (shift_id) REFERENCES public.shift(id) ON DELETE CASCADE;


--
-- Name: worker_location worker_location_worker_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_location
    ADD CONSTRAINT worker_location_worker_id_user_id_fk FOREIGN KEY (worker_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: worker_notification_preferences worker_notification_preferences_worker_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_notification_preferences
    ADD CONSTRAINT worker_notification_preferences_worker_id_user_id_fk FOREIGN KEY (worker_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: worker_role worker_role_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_role
    ADD CONSTRAINT worker_role_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: worker_role worker_role_worker_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_role
    ADD CONSTRAINT worker_role_worker_id_user_id_fk FOREIGN KEY (worker_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Yw1nqBggGQjI32kWyL6SCPKR1DMfOWrrntL1bpguuE36DvHpjkGg4RL4nMOJzFB

