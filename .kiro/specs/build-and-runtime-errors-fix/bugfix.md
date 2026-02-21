# Bugfix Requirements Document

## Introduction

This document addresses three critical bugs affecting the monorepo that prevent successful builds and runtime execution:

1. **DateTimePicker Native Module Error**: The React Native workers app crashes when attempting to use the DateTimePicker component due to missing native module linking
2. **API Unauthorized Error**: The workers app throws unauthorized errors at runtime when API requests receive 401 responses
3. **Vercel Build Failure**: The web app fails TypeScript compilation on Vercel due to duplicate react-hook-form dependencies with incompatible type definitions

These bugs block deployment and prevent core functionality from working correctly.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the workers app renders the request-adjustment screen with DateTimePicker THEN the system crashes with error "TurboModuleRegistry.getEnforcing(...): 'RNCMaterialDatePicker' could not be found"

1.2 WHEN the workers app receives a 401 Unauthorized response from any API endpoint THEN the system throws an unhandled error "Unauthorized" that crashes the app

1.3 WHEN the web app builds on Vercel with duplicate react-hook-form packages installed THEN TypeScript compilation fails with type incompatibility errors in create-schedule-form.tsx at line 129

### Expected Behavior (Correct)

2.1 WHEN the workers app renders the request-adjustment screen with DateTimePicker THEN the system SHALL display the native date/time picker without errors

2.2 WHEN the workers app receives a 401 Unauthorized response from any API endpoint THEN the system SHALL clear the session token, redirect to login, and NOT throw an unhandled error

2.3 WHEN the web app builds on Vercel THEN TypeScript compilation SHALL succeed with a single consistent version of react-hook-form types

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the workers app uses other Expo native modules that are properly configured THEN the system SHALL CONTINUE TO function correctly

3.2 WHEN the workers app receives non-401 API errors (400, 403, 404, 500, etc.) THEN the system SHALL CONTINUE TO throw appropriate error messages

3.3 WHEN the web app builds locally with Bun THEN the system SHALL CONTINUE TO build successfully

3.4 WHEN the web app uses react-hook-form in other components THEN the system SHALL CONTINUE TO have correct type inference and validation
