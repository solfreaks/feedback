plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // Uncomment to enable FCM push notifications (requires app/google-services.json):
    // id("com.google.gms.google-services")
}

android {
    namespace = "com.example.feedbackdemo"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.example.feedbackdemo"
        minSdk = 24
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

        // Replace these before running against a real server. The demo ships
        // with placeholders so the project builds out of the box.
        buildConfigField("String", "FEEDBACK_BASE_URL", "\"https://your-feedback-server.example.com\"")
        buildConfigField("String", "FEEDBACK_API_KEY", "\"replace-with-your-app-api-key\"")
        buildConfigField("String", "FEEDBACK_GOOGLE_CLIENT_ID", "\"replace-with-your-google-oauth-client-id\"")
    }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(project(":feedbacksdk"))
    implementation("androidx.core:core-ktx:1.18.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("com.google.android.material:material:1.13.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")

    // Uncomment together with the google-services plugin above to enable FCM:
    // implementation("com.google.firebase:firebase-messaging:25.0.1")
}
