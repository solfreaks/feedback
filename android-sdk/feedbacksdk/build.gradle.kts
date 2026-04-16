plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    `maven-publish`
}

android {
    namespace = "com.feedbacksdk"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }

    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }
}

// --- JitPack publishing --------------------------------------------------------
// JitPack builds the SDK from GitHub tags on-demand. There is no "publish"
// task to run manually — consumers request `com.github.solfreaks:feedback:<tag>`
// and JitPack triggers `./gradlew publishToMavenLocal` in its build environment,
// serving the artifacts it finds in the local Maven repo.
//
// Release flow:
//   1. Bump `sdk.version` in android-sdk/gradle.properties (e.g. 1.0.3)
//   2. Commit and push to main
//   3. git tag v1.0.3 && git push origin v1.0.3
//   4. (Optional) trigger a build at https://jitpack.io/#solfreaks/feedback
//
// Consumer usage:
//   repositories { maven { url = uri("https://jitpack.io") } }
//   implementation("com.github.solfreaks:feedback:1.0.3")
//
// Note: `com.github.<owner>` is the JitPack-mandated groupId format.
val sdkVersion: String = (project.findProperty("sdk.version") as String?) ?: "1.0.0"

publishing {
    publications {
        register<MavenPublication>("release") {
            groupId = "com.github.solfreaks"
            artifactId = "feedback"
            version = sdkVersion

            afterEvaluate {
                from(components["release"])
            }

            pom {
                name.set("FeedbackSDK")
                description.set("Android SDK for the Feedback support-ticket platform")
                url.set("https://github.com/solfreaks/feedback")
                licenses {
                    license {
                        name.set("Proprietary")
                    }
                }
            }
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.18.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("com.google.android.material:material:1.13.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.1")
    implementation("androidx.recyclerview:recyclerview:1.4.0")

    // Networking
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Image loading
    implementation("io.coil-kt:coil:2.7.0")

    // Google Sign-In
    implementation("com.google.android.gms:play-services-auth:21.5.1")

    // Firebase Cloud Messaging (optional — users add this dependency)
    compileOnly("com.google.firebase:firebase-messaging:25.0.1")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.10.0")
}
