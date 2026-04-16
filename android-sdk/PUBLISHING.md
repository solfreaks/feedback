# Publishing the FeedbackSDK via JitPack

The SDK is distributed through **JitPack** — a free Maven repository that
builds artifacts on-demand from the git tags of a public GitHub repo. Zero
credentials, zero manual publish step; you just push a tag and the first
consumer who requests that version triggers the build.

Artifact coordinates: **`com.github.solfreaks:feedback:<version>`**

Why JitPack:
- **Free** for public repos (which [solfreaks/feedback](https://github.com/solfreaks/feedback) is)
- **No auth** for consumers — just one Maven URL and the dependency line
- **No manual publish** — JitPack watches your tags and builds automatically
- Source already public, so nothing extra to expose

---

## Release procedure

### 1. Bump the version

Edit [gradle.properties](gradle.properties):

```properties
sdk.version=1.0.3
```

Semver:
- Patch (`1.0.2` → `1.0.3`) — bugfix, no API change
- Minor (`1.0.3` → `1.1.0`) — new backwards-compatible feature
- Major (`1.1.0` → `2.0.0`) — breaking API change

### 2. Commit and push to `main`

```bash
git add android-sdk/gradle.properties
git commit -m "Release SDK v1.0.3"
git push
```

### 3. Tag the release and push the tag

The tag name **is** the version JitPack will serve. Use plain semver (no `v`
prefix is fine either way — both work):

```bash
git tag 1.0.3
git push origin 1.0.3
```

### 4. (Optional) Warm the cache

The first consumer to request `com.github.solfreaks:feedback:1.0.3` will
trigger a JitPack build, which takes a few minutes. To do it yourself first:

1. Visit https://jitpack.io/#solfreaks/feedback
2. Click **Get it** next to the new tag
3. JitPack runs the build; you see a green badge if it succeeded

If the build fails, click **Log** on that line to see the Gradle output. Fix
and push a new tag (you cannot re-use a tag — JitPack caches failures too).

---

## Consumer install instructions

No credentials, no GitHub account required. Just two lines.

### 1. Add JitPack to the repositories

In the consumer's **`settings.gradle.kts`** (or root `build.gradle.kts` if
they use the older `allprojects` block):

```kotlin
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}
```

### 2. Add the dependency

In the app module's **`build.gradle.kts`**:

```kotlin
implementation("com.github.solfreaks:feedback:1.0.3")
```

That's the entire consumer setup.

---

## How JitPack builds the SDK

When a consumer requests a version for the first time:

1. JitPack clones `solfreaks/feedback` at the requested git tag
2. Reads [jitpack.yml](../jitpack.yml) at the repo root to get JDK version
3. Runs `cd android-sdk && ./gradlew :feedbacksdk:publishToMavenLocal`
4. Reads artifacts from `~/.m2/repository/com/github/solfreaks/feedback/<version>/`
5. Serves them at `https://jitpack.io/com/github/solfreaks/feedback/...`
6. Caches the result permanently — future consumers hit the cache

Relevant config files:
- [jitpack.yml](../jitpack.yml) — selects JDK 17 and points JitPack at the subproject
- [feedbacksdk/build.gradle.kts](feedbacksdk/build.gradle.kts) — the `maven-publish`
  block with `groupId="com.github.solfreaks"`, `artifactId="feedback"`

---

## Troubleshooting

### JitPack build fails
Visit https://jitpack.io/#solfreaks/feedback → click **Log** next to the
failing tag. Most common causes:
- Build requires JDK > 17 → bump `jdk:` in `jitpack.yml`
- Missing Gradle wrapper permission → ensure `android-sdk/gradlew` is
  executable in git (`git update-index --chmod=+x android-sdk/gradlew`)
- Depends on a resource not in the public repo → move it or vendor it

Push a new tag after the fix — **JitPack will not re-build the same tag**.

### Consumer gets `Could not find com.github.solfreaks:feedback:X.Y.Z`
- The tag `X.Y.Z` doesn't exist on GitHub → push it
- JitPack hasn't built it yet → wait a minute or visit
  https://jitpack.io/#solfreaks/feedback/X.Y.Z to force-trigger
- Consumer forgot `maven { url = uri("https://jitpack.io") }` in their
  `settings.gradle.kts`

### "Unable to reserve CPU" or slow builds on JitPack free tier
Free builds run on shared infrastructure; a first build can take 5–10 min.
Once a version is cached, subsequent consumers get it instantly.

### Want to test without tagging?
JitPack supports `-SNAPSHOT` builds from any branch — consumers can request
`com.github.solfreaks:feedback:main-SNAPSHOT` to get the tip of `main`. Use
this for internal testing before cutting a real version.

---

## Files involved

- [jitpack.yml](../jitpack.yml) — JitPack build config (JDK, install command)
- [feedbacksdk/build.gradle.kts](feedbacksdk/build.gradle.kts) — `maven-publish`
  plugin config, publication with `com.github.solfreaks:feedback` coordinates
- [gradle.properties](gradle.properties) — `sdk.version` (the published version)

No credentials anywhere. No `~/.gradle/gradle.properties` config needed.

---

## Migrating from the old GitHub Packages setup

Earlier versions of this doc had consumers pulling from
`https://maven.pkg.github.com/solfreaks/feedback` with PAT credentials. That
path still works for anyone on the old coordinates (`com.feedbacksdk:feedbacksdk`)
but is no longer the recommended install. Point consumers at JitPack instead:

**Old:**
```kotlin
maven {
    url = uri("https://maven.pkg.github.com/solfreaks/feedback")
    credentials { username = "..." ; password = "..." }
}
implementation("com.feedbacksdk:feedbacksdk:1.0.2")
```

**New:**
```kotlin
maven { url = uri("https://jitpack.io") }
implementation("com.github.solfreaks:feedback:1.0.3")
```
