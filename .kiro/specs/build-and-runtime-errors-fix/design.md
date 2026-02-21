# Build and Runtime Errors Fix - Bugfix Design

## Overview

This design addresses three critical bugs blocking deployment and runtime functionality in the monorepo:

1. **DateTimePicker Native Module Error**: React Native workers app crashes when rendering DateTimePicker due to missing native module configuration in the new architecture
2. **API Unauthorized Error**: Workers app throws unhandled "Unauthorized" errors on 401 responses instead of gracefully handling session expiration
3. **Vercel Build Failure**: Web app TypeScript compilation fails on Vercel due to duplicate react-hook-form dependencies with incompatible type definitions

The fix approach is minimal and targeted: enable Material DateTimePicker for new architecture, add proper error handling for 401 responses, and deduplicate react-hook-form dependencies.

## Glossary

- **Bug_Condition (C)**: The conditions that trigger each of the three bugs
- **Property (P)**: The desired behavior when bug conditions occur
- **Preservation**: Existing functionality that must remain unchanged
- **New Architecture**: React Native's new architecture (Fabric + TurboModules) enabled via `newArchEnabled: true`
- **TurboModuleRegistry**: React Native's new module system that requires explicit native module configuration
- **RNCMaterialDatePicker**: The native module name for @react-native-community/datetimepicker on Android
- **fetchJson**: The API client helper function in `apps/workers/lib/api.ts` that handles HTTP responses
- **SecureStore**: Expo's secure storage API for storing authentication tokens
- **react-hook-form**: Form library used in both web app and ui package, causing type conflicts when versions differ

## Bug Details

### Bug 1: DateTimePicker Native Module Error

#### Fault Condition

The bug manifests when the workers app renders the request-adjustment screen and attempts to display the DateTimePicker component. The app crashes with error "TurboModuleRegistry.getEnforcing(...): 'RNCMaterialDatePicker' could not be found".

**Formal Specification:**
```
FUNCTION isBugCondition1(input)
  INPUT: input of type { screen: string, component: string, architecture: string }
  OUTPUT: boolean
  
  RETURN input.screen == "request-adjustment"
         AND input.component == "DateTimePicker"
         AND input.architecture == "new"
         AND NOT nativeModuleConfigured("RNCMaterialDatePicker")
END FUNCTION
```

#### Examples

- User navigates to shift detail screen and taps "Request Adjustment" → DateTimePicker renders → App crashes with TurboModuleRegistry error
- User attempts to select clock-in time correction → DateTimePicker component mounts → Native module not found error
- User attempts to select clock-out time correction → DateTimePicker component mounts → Native module not found error
- Edge case: User on old architecture (newArchEnabled: false) → DateTimePicker works correctly (not affected by this bug)

### Bug 2: API Unauthorized Error

#### Fault Condition

The bug manifests when the workers app receives a 401 Unauthorized response from any API endpoint. The `fetchJson` function deletes the session token but then throws an unhandled "Unauthorized" error that crashes the app instead of redirecting to login.

**Formal Specification:**
```
FUNCTION isBugCondition2(input)
  INPUT: input of type { httpStatus: number, apiEndpoint: string }
  OUTPUT: boolean
  
  RETURN input.httpStatus == 401
         AND errorThrownAfterTokenDeletion()
         AND NOT redirectedToLogin()
END FUNCTION
```

#### Examples

- User's session expires, then user attempts to fetch shifts → API returns 401 → Token deleted but error thrown → App crashes
- User logs out on another device, then user attempts to clock in → API returns 401 → Token deleted but error thrown → App crashes
- User's token is invalidated, then user attempts to view profile → API returns 401 → Token deleted but error thrown → App crashes
- Edge case: API returns 403 Forbidden → Error thrown correctly (not affected by this bug)

### Bug 3: Vercel Build Failure

#### Fault Condition

The bug manifests when the web app builds on Vercel with duplicate react-hook-form packages installed (one in apps/web, one in packages/ui). TypeScript compilation fails with type incompatibility errors in create-schedule-form.tsx at line 129 where `useFieldArray` is called.

**Formal Specification:**
```
FUNCTION isBugCondition3(input)
  INPUT: input of type { environment: string, dependencies: Map<string, string[]> }
  OUTPUT: boolean
  
  RETURN input.environment == "vercel"
         AND dependencies.get("react-hook-form").length > 1
         AND typesIncompatible(dependencies.get("react-hook-form"))
END FUNCTION
```

#### Examples

- Vercel builds web app → npm/pnpm installs dependencies → Two react-hook-form versions installed → TypeScript fails at useFieldArray call
- Local build with Bun → Bun deduplicates dependencies → Single react-hook-form version → Build succeeds (not affected)
- Vercel builds with single react-hook-form version → TypeScript compilation succeeds (expected behavior after fix)
- Edge case: Other packages with duplicate dependencies → Build succeeds if types are compatible (not affected by this bug)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

**Bug 1 - DateTimePicker:**
- Other Expo native modules (expo-location, expo-notifications, expo-secure-store) must continue to function correctly
- DateTimePicker on iOS must continue to work without changes
- DateTimePicker on old architecture (if newArchEnabled is disabled) must continue to work

**Bug 2 - API Unauthorized:**
- Non-401 API errors (400, 403, 404, 500, etc.) must continue to throw appropriate error messages
- Successful API responses (200, 201, 204) must continue to return data correctly
- Token storage and retrieval for authenticated requests must continue to work

**Bug 3 - Vercel Build:**
- Local builds with Bun must continue to build successfully
- react-hook-form usage in other components must continue to have correct type inference
- Other shared dependencies between web and ui packages must continue to work correctly

**Scope:**

**Bug 1:** All inputs that do NOT involve rendering DateTimePicker in the new architecture should be completely unaffected by this fix. This includes other native modules, other screens, and other UI components.

**Bug 2:** All inputs that do NOT involve 401 responses should be completely unaffected by this fix. This includes successful requests, other error codes, and non-API operations.

**Bug 3:** All inputs that do NOT involve building on Vercel with duplicate react-hook-form should be completely unaffected by this fix. This includes local builds, other dependencies, and other TypeScript compilation.

## Hypothesized Root Cause

### Bug 1: DateTimePicker Native Module Error

Based on the bug description and code analysis, the most likely issues are:

1. **Missing Material DateTimePicker Configuration**: The new architecture requires explicit native module configuration. The plugin `@react-native-community/datetimepicker` is listed in app.json but may not be properly configured for the new architecture's TurboModule system.

2. **Incomplete Prebuild**: The native iOS project may have been generated before the DateTimePicker plugin was added, or the prebuild didn't properly link the native module for the new architecture.

3. **Android-Specific Module Name**: The error mentions 'RNCMaterialDatePicker' which is the Android module name. The iOS module name is different, suggesting this might be an Android-specific configuration issue.

4. **Plugin Configuration Format**: The plugin is listed as a simple string `"@react-native-community/datetimepicker"` in app.json, but the new architecture might require additional configuration options.

### Bug 2: API Unauthorized Error

Based on the code in `apps/workers/lib/api.ts`, the issue is clear:

1. **Incomplete Error Handling**: The `fetchJson` function at line 126-129 detects 401 status and deletes the session token, but then continues to the error throwing logic at line 131-140. The function throws an error with message "Unauthorized" instead of returning early or redirecting to login.

2. **Missing Navigation Logic**: There is no navigation/redirect logic after deleting the token. The function should either:
   - Return early without throwing an error (silent handling)
   - Throw a specific error type that the app can catch and handle with navigation
   - Directly trigger navigation to the login screen

3. **Cascading Promise Rejection**: The comment on line 129 says "Optionally, we could still throw here so the rejecting promise cascades to the caller" - this suggests the current behavior is intentional but incomplete. The callers are not prepared to handle 401 errors gracefully.

### Bug 3: Vercel Build Failure

Based on the package.json analysis, the issue is:

1. **Duplicate Dependencies**: Both `apps/web/package.json` and `packages/ui/package.json` list `react-hook-form: ^7.69.0` as dependencies. When Vercel's package manager (npm or pnpm) installs dependencies, it may create two separate installations of react-hook-form with slightly different resolved versions.

2. **Type Incompatibility**: Even though both specify `^7.69.0`, the caret range allows minor version differences. TypeScript sees two different type definitions for the same library, causing type errors at line 129 where `useFieldArray` is imported from react-hook-form.

3. **Bun vs Vercel Package Manager**: Bun has aggressive deduplication that automatically resolves this, but Vercel uses npm or pnpm which may not deduplicate as aggressively, especially in monorepo setups.

4. **Monorepo Hoisting**: The monorepo may not be properly configured to hoist react-hook-form to the root, causing each package to get its own copy.

## Correctness Properties

Property 1: Fault Condition - DateTimePicker Renders Without Crash

_For any_ screen render where DateTimePicker component is mounted in the new architecture, the fixed app SHALL successfully render the native date/time picker without throwing TurboModuleRegistry errors, allowing users to select dates and times.

**Validates: Requirements 2.1**

Property 2: Fault Condition - 401 Responses Handled Gracefully

_For any_ API request that receives a 401 Unauthorized response, the fixed fetchJson function SHALL delete the session token, redirect to the login screen, and NOT throw an unhandled error that crashes the app.

**Validates: Requirements 2.2**

Property 3: Fault Condition - Vercel Build Succeeds

_For any_ Vercel build of the web app, the fixed dependency configuration SHALL result in a single consistent version of react-hook-form types, allowing TypeScript compilation to succeed without type incompatibility errors.

**Validates: Requirements 2.3**

Property 4: Preservation - Other Native Modules Unchanged

_For any_ usage of other Expo native modules (expo-location, expo-notifications, expo-secure-store), the fixed app SHALL produce exactly the same behavior as the original app, preserving all existing native module functionality.

**Validates: Requirements 3.1**

Property 5: Preservation - Non-401 Error Handling Unchanged

_For any_ API request that receives a non-401 error response (400, 403, 404, 500, etc.), the fixed fetchJson function SHALL produce exactly the same error throwing behavior as the original function, preserving existing error handling.

**Validates: Requirements 3.2**

Property 6: Preservation - Local Build Success Unchanged

_For any_ local build of the web app using Bun, the fixed dependency configuration SHALL produce exactly the same successful build as the original configuration, preserving local development workflow.

**Validates: Requirements 3.3, 3.4**

## Fix Implementation

### Bug 1: DateTimePicker Native Module Error

Assuming our root cause analysis is correct:

**File**: `apps/workers/app.json`

**Section**: `plugins` array

**Specific Changes**:

1. **Update Plugin Configuration**: Change the DateTimePicker plugin from a simple string to a configuration object with Material DatePicker enabled:
   ```json
   [
     "@react-native-community/datetimepicker",
     {
       "android": {
         "useMaterialDatePicker": true
       }
     }
   ]
   ```

2. **Verify Plugin Order**: Ensure the DateTimePicker plugin is listed before `expo-build-properties` to ensure proper configuration precedence

3. **Rebuild Native Project**: After configuration change, run `npx expo prebuild --clean` to regenerate native iOS/Android projects with correct TurboModule configuration

4. **Verify Autolinking**: Check that `apps/workers/ios/build/generated/autolinking/autolinking.json` includes the DateTimePicker module after prebuild

### Bug 2: API Unauthorized Error

Assuming our root cause analysis is correct:

**File**: `apps/workers/lib/api.ts`

**Function**: `fetchJson`

**Specific Changes**:

1. **Add Navigation Import**: Import router from expo-router at the top of the file:
   ```typescript
   import { router } from 'expo-router';
   ```

2. **Update 401 Handling**: Modify the 401 handling block (lines 126-129) to redirect to login and return early:
   ```typescript
   if (response.status === 401) {
       await SecureStore.deleteItemAsync("better-auth.session_token");
       router.replace('/login');
       throw new Error('Session expired. Please log in again.');
   }
   ```

3. **Alternative Approach**: If direct navigation from API client is not desired, create a custom error class:
   ```typescript
   export class UnauthorizedError extends Error {
       constructor() {
           super('Unauthorized');
           this.name = 'UnauthorizedError';
       }
   }
   ```
   Then throw this error and handle it in a global error boundary or in each API call site.

### Bug 3: Vercel Build Failure

Assuming our root cause analysis is correct:

**File**: `packages/ui/package.json`

**Section**: `dependencies`

**Specific Changes**:

1. **Move to Peer Dependencies**: Remove `react-hook-form` from `packages/ui/package.json` dependencies and add it to `peerDependencies`:
   ```json
   "peerDependencies": {
     "react": "^19.0.0",
     "react-dom": "^19.0.0",
     "react-hook-form": "^7.69.0"
   }
   ```

2. **Update Package Manager Config**: Add or update `.npmrc` or `pnpm-workspace.yaml` to ensure proper hoisting:
   ```
   # .npmrc
   hoist=true
   hoist-pattern[]=*
   ```

3. **Alternative: Explicit Resolution**: Add a `resolutions` field to root `package.json` to force a single version:
   ```json
   "resolutions": {
     "react-hook-form": "7.69.0"
   }
   ```

4. **Verify Build**: Test build on Vercel or with npm/pnpm locally to ensure single react-hook-form installation

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fixes. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

#### Bug 1: DateTimePicker

**Test Plan**: Write tests that render the request-adjustment screen and attempt to interact with DateTimePicker. Run these tests on the UNFIXED code to observe the TurboModuleRegistry error.

**Test Cases**:
1. **Render DateTimePicker Test**: Mount request-adjustment screen → Tap "Clock In" time button → DateTimePicker renders (will fail on unfixed code with TurboModuleRegistry error)
2. **Select Time Test**: Render DateTimePicker → Select a time → Verify time is set (will fail on unfixed code before time selection)
3. **Android Specific Test**: Run on Android device/emulator → Render DateTimePicker → Verify Material DatePicker appears (will fail on unfixed code)
4. **iOS Comparison Test**: Run on iOS device/simulator → Render DateTimePicker → Verify iOS picker appears (may succeed on unfixed code, confirming Android-specific issue)

**Expected Counterexamples**:
- TurboModuleRegistry.getEnforcing error when DateTimePicker mounts
- Possible causes: missing native module configuration, incomplete prebuild, Android-specific module name issue

#### Bug 2: API Unauthorized

**Test Plan**: Write tests that simulate 401 responses from API endpoints. Run these tests on the UNFIXED code to observe the unhandled error crash.

**Test Cases**:
1. **Expired Session Test**: Mock API to return 401 → Call api.shifts.getUpcoming() → Verify error is thrown (will fail on unfixed code with unhandled error)
2. **Token Deletion Test**: Mock API to return 401 → Call any API endpoint → Verify token is deleted from SecureStore (will succeed on unfixed code)
3. **No Redirect Test**: Mock API to return 401 → Call any API endpoint → Verify NO redirect to login occurs (will succeed on unfixed code, confirming missing redirect)
4. **Error Propagation Test**: Mock API to return 401 → Call API from component → Verify error crashes app (will succeed on unfixed code, confirming unhandled error)

**Expected Counterexamples**:
- Token is deleted but error is thrown without navigation
- App crashes when 401 error propagates to UI components
- Possible causes: incomplete error handling, missing navigation logic

#### Bug 3: Vercel Build

**Test Plan**: Simulate Vercel build environment locally using npm or pnpm. Run TypeScript compilation on the UNFIXED code to observe type errors.

**Test Cases**:
1. **Duplicate Installation Test**: Run `npm install` or `pnpm install` → Check node_modules → Verify two react-hook-form installations exist (will succeed on unfixed code)
2. **TypeScript Compilation Test**: Run `tsc --noEmit` in apps/web → Verify type error at create-schedule-form.tsx:129 (will fail on unfixed code)
3. **Bun Build Test**: Run `bun install` → Run `bun run build` → Verify build succeeds (will succeed on unfixed code, confirming Bun deduplication)
4. **Type Resolution Test**: Check TypeScript's module resolution → Verify two different react-hook-form type definitions (will succeed on unfixed code)

**Expected Counterexamples**:
- TypeScript error: Type 'X' is not assignable to type 'Y' at useFieldArray call
- Two separate react-hook-form installations in node_modules
- Possible causes: duplicate dependencies, missing hoisting configuration

### Fix Checking

**Goal**: Verify that for all inputs where the bug conditions hold, the fixed code produces the expected behavior.

#### Bug 1: DateTimePicker

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition1(input) DO
  result := renderDateTimePicker_fixed(input)
  ASSERT result.rendered == true
  ASSERT result.error == null
  ASSERT result.nativeModuleFound == true
END FOR
```

**Test Cases**:
- Render DateTimePicker on Android with new architecture → Verify Material DatePicker appears
- Select time from DateTimePicker → Verify time is set correctly
- Render DateTimePicker multiple times → Verify no crashes occur

#### Bug 2: API Unauthorized

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition2(input) DO
  result := fetchJson_fixed(input)
  ASSERT result.tokenDeleted == true
  ASSERT result.redirectedToLogin == true
  ASSERT result.errorHandled == true
END FOR
```

**Test Cases**:
- Mock 401 response → Call API → Verify token deleted and redirect occurs
- Mock 401 response → Call API from component → Verify no crash occurs
- Mock 401 response → Verify user sees login screen

#### Bug 3: Vercel Build

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition3(input) DO
  result := buildWebApp_fixed(input)
  ASSERT result.buildSuccess == true
  ASSERT result.typeErrors == 0
  ASSERT result.reactHookFormInstallations == 1
END FOR
```

**Test Cases**:
- Run npm/pnpm install → Verify single react-hook-form installation
- Run TypeScript compilation → Verify no type errors
- Build on Vercel → Verify successful deployment

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed code produces the same result as the original code.

#### Bug 1: DateTimePicker

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition1(input) DO
  ASSERT renderComponent_original(input) = renderComponent_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates many test cases automatically across the input domain and catches edge cases that manual unit tests might miss.

**Test Plan**: Observe behavior on UNFIXED code first for other native modules and screens, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Other Native Modules**: Observe that expo-location, expo-notifications work correctly on unfixed code, then verify they continue working after fix
2. **iOS DateTimePicker**: Observe that iOS DateTimePicker works correctly on unfixed code, then verify it continues working after fix
3. **Other Screens**: Observe that non-adjustment screens work correctly on unfixed code, then verify they continue working after fix

#### Bug 2: API Unauthorized

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition2(input) DO
  ASSERT fetchJson_original(input) = fetchJson_fixed(input)
END FOR
```

**Test Plan**: Observe behavior on UNFIXED code first for successful requests and non-401 errors, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Successful Requests**: Observe that 200/201 responses return data correctly on unfixed code, then verify they continue working after fix
2. **Other Error Codes**: Observe that 400/403/404/500 responses throw errors correctly on unfixed code, then verify they continue throwing after fix
3. **Token Storage**: Observe that token storage/retrieval works correctly on unfixed code, then verify it continues working after fix

#### Bug 3: Vercel Build

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition3(input) DO
  ASSERT buildWebApp_original(input) = buildWebApp_fixed(input)
END FOR
```

**Test Plan**: Observe behavior on UNFIXED code first for local builds and other dependencies, then write tests capturing that behavior.

**Test Cases**:
1. **Local Bun Build**: Observe that local build succeeds on unfixed code, then verify it continues succeeding after fix
2. **Other Form Components**: Observe that other react-hook-form usage works correctly on unfixed code, then verify it continues working after fix
3. **Other Shared Dependencies**: Observe that other shared packages work correctly on unfixed code, then verify they continue working after fix

### Unit Tests

**Bug 1: DateTimePicker**
- Test DateTimePicker renders without errors on Android
- Test DateTimePicker renders without errors on iOS
- Test time selection updates state correctly
- Test DateTimePicker dismissal works correctly

**Bug 2: API Unauthorized**
- Test 401 response deletes token
- Test 401 response redirects to login
- Test 401 response does not crash app
- Test non-401 errors still throw correctly

**Bug 3: Vercel Build**
- Test single react-hook-form installation exists
- Test TypeScript compilation succeeds
- Test useFieldArray types are correct
- Test form submission works correctly

### Property-Based Tests

**Bug 1: DateTimePicker**
- Generate random date/time values → Verify DateTimePicker can display and select them
- Generate random screen navigation sequences → Verify DateTimePicker always renders correctly
- Generate random device configurations → Verify DateTimePicker works across configurations

**Bug 2: API Unauthorized**
- Generate random API endpoints → Verify 401 handling works for all endpoints
- Generate random error codes → Verify non-401 errors are preserved
- Generate random request sequences → Verify token handling is consistent

**Bug 3: Vercel Build**
- Generate random form configurations → Verify react-hook-form types work correctly
- Generate random dependency trees → Verify deduplication works correctly
- Generate random build environments → Verify builds succeed consistently

### Integration Tests

**Bug 1: DateTimePicker**
- Test full adjustment request flow with time selection
- Test switching between clock-in and clock-out time pickers
- Test submitting adjustment request with corrected times

**Bug 2: API Unauthorized**
- Test session expiration during shift fetch
- Test session expiration during clock-in
- Test re-login after session expiration

**Bug 3: Vercel Build**
- Test full Vercel deployment pipeline
- Test form creation and submission in deployed app
- Test type checking in CI/CD pipeline
