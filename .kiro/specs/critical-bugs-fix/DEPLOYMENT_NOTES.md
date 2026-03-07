# Deployment Notes - Phase 1

## Tasks Requiring Database Access

The following tasks from Phase 1 require a live database connection and should be executed when ready:

### Task 3.3: Run migration in staging environment
```bash
# 1. Ensure DATABASE_URL is set for staging
export DATABASE_URL="postgresql://..."

# 2. Run data cleanup script first
bun packages/database/scripts/fix-invalid-geofence-radius.ts

# 3. Apply migration
cd packages/database
psql $DATABASE_URL -f drizzle/0010_critical_bugs_fix_phase1.sql

# 4. Verify indexes created
psql $DATABASE_URL -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'location' AND indexname LIKE '%gist%';"

# 5. Verify CHECK constraint
psql $DATABASE_URL -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'check_geofence_radius_range';"
```

### Task 3.4: Verify exploration tests show expected behavior
```bash
# After migration, these tests should PASS (bugs are fixed)
bun --env-file=.env test packages/database/tests/exploration-geo-003-invalid-radius.test.ts
bun --env-file=.env test packages/database/tests/exploration-geo-002-missing-spatial-index.test.ts
```

### Task 3.5: Verify preservation tests still pass
```bash
# These tests should STILL PASS (no regressions)
bun --env-file=.env test packages/database/tests/preservation-geo-003-valid-radius.test.ts
bun --env-file=.env test packages/database/tests/preservation-geo-002-spatial-correctness.test.ts
```

### Task 3.6: Deploy migration to production
```bash
# Same steps as staging, but with production DATABASE_URL
# Schedule during low-traffic window
# Monitor performance metrics after deployment
```

## Proceeding with Phase 2

Since Phase 1 implementation is code-complete and only requires database deployment, I'm proceeding with Phase 2 (Tenant Isolation) which is the highest priority security-critical work.

Phase 2 tasks are primarily code changes that don't require database migrations, so they can be developed in parallel with Phase 1 deployment.
