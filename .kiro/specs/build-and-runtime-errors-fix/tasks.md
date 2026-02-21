# Implementation Plan

## Bug 1: DateTimePicker Native Module Error

- [x] 1. Write bug condition exploration test for DateTimePicker crash
  - **Property 1: Fault Condition** - DateTimePicker TurboModuleRegistry Error
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the DateTimePicker crash exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case: rendering DateTimePicker on Android with new architecture
  - Test that rendering the request-adjustment screen with DateTimePicker component does NOT throw TurboModuleRegistry error "RNCMaterialDatePicker could not be found"
  - Test that DateTimePicker successfully renders the native Material DatePicker UI
  - Test that time selection works without crashes
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS with TurboModuleRegistry error (this is correct - it proves the bug exists)
  - Document counterexamples found: specific screens, components, and error messages
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 2.1_

- [~] 2. Write preservation property tests for DateTimePicker (BEFORE implementing fix)
  - **Property 2: Preservation** - Other Native Modules and iOS DateTimePicker
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (other native modules, iOS DateTimePicker, other screens)
  - Write property-based tests capturing observed behavior patterns:
    - expo-location continues to function correctly
    - expo-notifications continues to function correctly
    - expo-secure-store continues to function correctly
    - iOS DateTimePicker continues to work without changes
    - Other screens render without DateTimePicker-related errors
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1_

- [ ] 3. Fix DateTimePicker native module configuration

  - [~] 3.1 Update DateTimePicker plugin configuration in app.json
    - Change DateTimePicker plugin from simple string to configuration object
    - Enable Material DatePicker for Android: `{ "android": { "useMaterialDatePicker": true } }`
    - Verify plugin order: ensure DateTimePicker is before expo-build-properties
    - _Bug_Condition: isBugCondition1(input) where input.screen == "request-adjustment" AND input.component == "DateTimePicker" AND input.architecture == "new" AND NOT nativeModuleConfigured("RNCMaterialDatePicker")_
    - _Expected_Behavior: DateTimePicker renders without TurboModuleRegistry errors (Property 1)_
    - _Preservation: Other Expo native modules continue to function correctly (Property 4)_
    - _Requirements: 1.1, 2.1, 3.1_

  - [~] 3.2 Rebuild native project with updated configuration
    - Run `npx expo prebuild --clean` to regenerate native iOS/Android projects
    - Verify autolinking includes DateTimePicker module in generated files
    - Check `apps/workers/ios/build/generated/autolinking/autolinking.json` for DateTimePicker entry
    - _Requirements: 2.1_

  - [~] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - DateTimePicker Renders Without Crash
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms DateTimePicker bug is fixed)
    - _Requirements: 2.1_

  - [~] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Other Native Modules and iOS DateTimePicker
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in other native modules)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1_

- [~] 4. Checkpoint - Ensure DateTimePicker tests pass
  - Verify bug condition test passes (DateTimePicker renders without crash)
  - Verify preservation tests pass (other native modules work correctly)
  - Ask user if questions arise

## Bug 2: API Unauthorized Error

- [x] 5. Write bug condition exploration test for 401 error handling
  - **Property 1: Fault Condition** - Unhandled 401 Error Crash
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the unhandled 401 error crash
  - **Scoped PBT Approach**: Scope the property to the concrete failing case: API request receiving 401 response
  - Test that when fetchJson receives a 401 response, it deletes the session token
  - Test that when fetchJson receives a 401 response, it redirects to login screen
  - Test that when fetchJson receives a 401 response, it does NOT throw an unhandled error that crashes the app
  - Mock API to return 401 for various endpoints (shifts, clock-in, profile)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS with unhandled "Unauthorized" error (this is correct - it proves the bug exists)
  - Document counterexamples found: specific API endpoints and error propagation behavior
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.2, 2.2_

- [~] 6. Write preservation property tests for API error handling (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-401 Error Handling
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (successful requests, non-401 errors)
  - Write property-based tests capturing observed behavior patterns:
    - 200/201/204 responses return data correctly
    - 400 Bad Request errors throw appropriate error messages
    - 403 Forbidden errors throw appropriate error messages
    - 404 Not Found errors throw appropriate error messages
    - 500 Internal Server errors throw appropriate error messages
    - Token storage and retrieval for authenticated requests works correctly
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.2_

- [ ] 7. Fix API 401 error handling in fetchJson

  - [x] 7.1 Add navigation import and update 401 handling logic
    - Import router from expo-router at top of apps/workers/lib/api.ts
    - Update 401 handling block (lines 126-129) to redirect to login after deleting token
    - Add `router.replace('/login')` after token deletion
    - Throw descriptive error: "Session expired. Please log in again."
    - Ensure error is handled gracefully without crashing the app
    - _Bug_Condition: isBugCondition2(input) where input.httpStatus == 401 AND errorThrownAfterTokenDeletion() AND NOT redirectedToLogin()_
    - _Expected_Behavior: Token deleted, redirect to login, no unhandled error crash (Property 2)_
    - _Preservation: Non-401 errors continue to throw appropriate error messages (Property 5)_
    - _Requirements: 1.2, 2.2, 3.2_

  - [~] 7.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 401 Handled Gracefully
    - **IMPORTANT**: Re-run the SAME test from task 5 - do NOT write a new test
    - The test from task 5 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 5
    - **EXPECTED OUTCOME**: Test PASSES (confirms 401 error handling is fixed)
    - _Requirements: 2.2_

  - [~] 7.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-401 Error Handling
    - **IMPORTANT**: Re-run the SAME tests from task 6 - do NOT write new tests
    - Run preservation property tests from step 6
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in other error handling)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.2_

- [~] 8. Checkpoint - Ensure API error handling tests pass
  - Verify bug condition test passes (401 handled gracefully)
  - Verify preservation tests pass (non-401 errors work correctly)
  - Ask user if questions arise

## Bug 3: Vercel Build Failure

- [~] 9. Write bug condition exploration test for Vercel build failure
  - **Property 1: Fault Condition** - TypeScript Compilation Failure
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the TypeScript compilation failure
  - **Scoped PBT Approach**: Scope the property to the concrete failing case: Vercel build with duplicate react-hook-form
  - Test that running npm/pnpm install results in a SINGLE react-hook-form installation
  - Test that TypeScript compilation succeeds without type incompatibility errors
  - Test that create-schedule-form.tsx line 129 (useFieldArray) compiles without errors
  - Simulate Vercel build environment locally using npm or pnpm
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS with TypeScript type errors (this is correct - it proves the bug exists)
  - Document counterexamples found: duplicate installations, specific type errors, affected files
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.3, 2.3_

- [~] 10. Write preservation property tests for build process (BEFORE implementing fix)
  - **Property 2: Preservation** - Local Build and Other Dependencies
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (local Bun builds, other form components)
  - Write property-based tests capturing observed behavior patterns:
    - Local builds with Bun continue to build successfully
    - react-hook-form usage in other components continues to have correct type inference
    - Other shared dependencies between web and ui packages continue to work correctly
    - Form submission and validation continue to work correctly
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.3, 3.4_

- [ ] 11. Fix react-hook-form dependency duplication

  - [x] 11.1 Move react-hook-form to peer dependencies in ui package
    - Remove react-hook-form from dependencies in packages/ui/package.json
    - Add react-hook-form to peerDependencies in packages/ui/package.json with version ^7.69.0
    - Ensure apps/web/package.json keeps react-hook-form in dependencies
    - _Bug_Condition: isBugCondition3(input) where input.environment == "vercel" AND dependencies.get("react-hook-form").length > 1 AND typesIncompatible(dependencies.get("react-hook-form"))_
    - _Expected_Behavior: Single react-hook-form installation, TypeScript compilation succeeds (Property 3)_
    - _Preservation: Local Bun builds continue to succeed, other form components work correctly (Property 6)_
    - _Requirements: 1.3, 2.3, 3.3, 3.4_

  - [x] 11.2 Add package manager configuration for proper hoisting
    - Create or update .npmrc with hoist configuration: `hoist=true` and `hoist-pattern[]=*`
    - Alternatively, add resolutions field to root package.json to force single version
    - Test with npm/pnpm install to verify single installation
    - _Requirements: 2.3_

  - [~] 11.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Vercel Build Succeeds
    - **IMPORTANT**: Re-run the SAME test from task 9 - do NOT write a new test
    - The test from task 9 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 9
    - **EXPECTED OUTCOME**: Test PASSES (confirms Vercel build is fixed)
    - _Requirements: 2.3_

  - [~] 11.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Local Build and Other Dependencies
    - **IMPORTANT**: Re-run the SAME tests from task 10 - do NOT write new tests
    - Run preservation property tests from step 10
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in local builds or other dependencies)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.3, 3.4_

- [~] 12. Checkpoint - Ensure all build tests pass
  - Verify bug condition test passes (Vercel build succeeds)
  - Verify preservation tests pass (local builds and other dependencies work correctly)
  - Ask user if questions arise

## Final Validation

- [~] 13. Run full test suite and verify all fixes
  - Run all exploration tests (tasks 1, 5, 9) - all should PASS
  - Run all preservation tests (tasks 2, 6, 10) - all should PASS
  - Verify DateTimePicker renders correctly on Android
  - Verify 401 responses redirect to login without crashes
  - Verify Vercel builds succeed with TypeScript compilation
  - Verify no regressions in other native modules, error handling, or build processes
  - Ask user if questions arise or if ready to deploy
