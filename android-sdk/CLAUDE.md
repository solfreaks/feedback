# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Android library that provides feedback, support-ticket, and rating functionality backed by the Express/Prisma server in the sibling `server/` directory. Two Gradle modules: `:feedbacksdk` (the publishable Android library) and `:app` (a minimal demo consumer that depends on `:feedbacksdk` via `project(...)` — exists only to exercise the SDK during development, not shipped).

## Commands

Gradle wrapper lives at the repo root. Run from `android-sdk/`:

- `./gradlew :feedbacksdk:assembleDebug` — build library AAR (debug)
- `./gradlew :feedbacksdk:assembleRelease` — build shippable AAR; output at `feedbacksdk/build/outputs/aar/feedbacksdk-release.aar`
- `./gradlew :app:assembleDebug` — build the demo app APK
- `./gradlew :app:installDebug` — install the demo app on a connected device/emulator
- `./gradlew build` — build everything
- `./gradlew clean`

No test framework or lint task is configured in these modules. The README is authoritative for public SDK consumer-facing usage.

## Architecture

### Module layout
- `feedbacksdk/` — `com.android.library`, namespace `com.feedbacksdk`, minSdk 24, compileSdk 36, Java/Kotlin 17, viewBinding on
- `app/` — `com.android.application`, namespace `com.example.feedbackdemo`, Java 17. Minimal demo with a single `MainActivity` exposing buttons for each SDK entry point (sign in, create ticket, my tickets, feedback, logout). Server URL / API key / Google client ID are injected via `buildConfigField` in `app/build.gradle.kts` — replace the placeholders before running against a real server. The `google-services` plugin + `firebase-messaging` dep are commented out; re-enable them and drop in `google-services.json` to test FCM.

### SDK entry point
`FeedbackSDK` (object singleton) in `feedbacksdk/src/main/java/com/feedbacksdk/FeedbackSDK.kt` is the ONLY public API surface. All consumer interaction goes through it. Every public method calls `checkInit()` first — `initialize()` must be called before anything else (typically in `Application.onCreate`).

The SDK has two usage modes, both exposed by the same object:
1. **Programmatic**: `suspend` functions returning `SdkResult<T>` (sealed class `Success`/`Error`) — consumer builds their own UI.
2. **Pre-built UI**: `openCreateTicket`/`openTicketList`/`openTicketDetail`/`openFeedback` launch activities bundled in the library under `com.feedbacksdk.ui.*`.

### Internals (all `internal` visibility — do not expose)
- `api/ApiClient` — Retrofit + OkHttp singleton. Injects `x-api-key` header (app API key from feedback server admin panel) and `Authorization: Bearer <jwt>` via interceptor. Base URL is normalized with a trailing slash. `debug=true` attaches an `HttpLoggingInterceptor` at `BODY` level.
- `api/FeedbackApi` — Retrofit interface matching the server's route shape (`/auth/google`, `/tickets`, `/feedback`, `/device-tokens`).
- `internal/TokenStore` — persists JWT + current `User` (via `SharedPreferences`). `FeedbackSDK.initialize()` reads it back into `ApiClient.authToken` so auth survives process death.
- `internal/Result.toResult()` — extension on Retrofit `Response<T>` that parses error bodies as `ErrorResponse { error: String }` (matches server's error JSON) and wraps everything into `SdkResult`.

### Server contract
The SDK talks to the server documented in `/Volumes/Work/feedback/CLAUDE.md`. Two coupling points to remember when changing either side:
- The `x-api-key` header is required by `middleware/appKey.ts` — per-app key configured in the admin panel.
- Google Sign-In uses the server's `POST /auth/google` with `{idToken}` body; the server verifies against Google and returns `{token, user}`.

### FCM push notifications
`firebase-messaging` is a `compileOnly` dep of `:feedbacksdk` — consumers MUST add the runtime dep themselves, otherwise `FeedbackFirebaseService` will fail to load. This is intentional so apps that don't use FCM don't pull in Firebase. `FeedbackFirebaseService.onNewToken` auto-registers with the server only if the user is logged in; silent failures are expected (retried next launch).

### Activities & manifest
Library `AndroidManifest.xml` declares the 4 UI activities with `FeedbackSDK.Theme` and `exported=false` — they merge into the consumer app's manifest automatically. Any new activity added to `com.feedbacksdk.ui.*` MUST also be registered there.

## Conventions

- All suspend API methods wrap their body in `try/catch` and return `SdkResult.Error(e.message ?: "fallback")` — keep this pattern; never let exceptions leak to consumers.
- Models in `models/Models.kt` are Gson-serialized DTOs; field names must match server JSON exactly (no `@SerializedName` overrides used currently).
- The `:feedbacksdk` module must not depend on anything app-specific; the `:app` module is where test/demo code belongs.
- When adding transitive deps that consumers need for the AAR-drop install path, update the README's "Option 2: AAR file" block accordingly.
