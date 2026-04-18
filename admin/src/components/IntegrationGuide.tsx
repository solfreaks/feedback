import { useState } from "react";

/**
 * Copy-paste integration snippets keyed per platform. Lives on the app detail
 * page so admins always have a reference (not just during first-time onboarding).
 *
 * The snippets intentionally include the app's real API key + appId so they're
 * truly copy-ready — no placeholders for the user to hunt for.
 */

type Platform = "android" | "flutter" | "ios" | "react_native" | "web";

const PLATFORMS: { value: Platform; label: string; emoji: string }[] = [
  { value: "android", label: "Android (Kotlin)", emoji: "📱" },
  { value: "flutter", label: "Flutter", emoji: "🦋" },
  { value: "ios", label: "iOS (Swift)", emoji: "" },
  { value: "react_native", label: "React Native", emoji: "⚛️" },
  { value: "web", label: "Web / Other", emoji: "🌐" },
];

function androidSnippet(apiKey: string, appId: string, baseUrl: string) {
  return `// settings.gradle.kts — add JitPack
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}

// app/build.gradle.kts
dependencies {
    implementation("com.github.solfreaks:feedback:2.0.0")
}

// Application.onCreate()
FeedbackSDK.initialize(
    context = this,
    baseUrl = "${baseUrl}",
    apiKey = "${apiKey}",
    appId = "${appId}",
    debug = BuildConfig.DEBUG,
)

// Launch pre-built screens from anywhere
FeedbackSDK.openTicketList(activity)
FeedbackSDK.openFeedback(activity)
FeedbackSDK.openNotifications(activity)
`;
}

function flutterSnippet(apiKey: string, _appId: string, baseUrl: string) {
  return `// pubspec.yaml
dependencies:
  http: ^1.2.0
  google_sign_in: ^6.2.1

// lib/feedback_api.dart
final client = http.Client();

Future<http.Response> apiGet(String path, {String? jwt}) {
  return client.get(
    Uri.parse('${baseUrl}\$path'),
    headers: {
      'x-api-key': '${apiKey}',
      if (jwt != null) 'Authorization': 'Bearer \$jwt',
    },
  );
}
`;
}

function iosSnippet(apiKey: string, _appId: string, baseUrl: string) {
  return `// Podfile
pod 'Alamofire', '~> 5.9'
pod 'GoogleSignIn', '~> 7.1'

// FeedbackAPI.swift
struct FeedbackAPI {
    static let baseURL = "${baseUrl}"
    static let apiKey = "${apiKey}"

    static func request(_ path: String, jwt: String? = nil) -> URLRequest {
        var req = URLRequest(url: URL(string: baseURL + path)!)
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        if let jwt = jwt {
            req.setValue("Bearer \\(jwt)", forHTTPHeaderField: "Authorization")
        }
        return req
    }
}
`;
}

function reactNativeSnippet(apiKey: string, _appId: string, baseUrl: string) {
  return `// package.json
"dependencies": {
  "axios": "^1.7.0",
  "@react-native-google-signin/google-signin": "^12.0.0"
}

// api.js
import axios from 'axios';

export const api = axios.create({
  baseURL: '${baseUrl}',
  headers: { 'x-api-key': '${apiKey}' },
});

// After login:
api.defaults.headers.Authorization = \`Bearer \${jwt}\`;
`;
}

function webSnippet(apiKey: string, _appId: string, baseUrl: string) {
  return `// Every request needs the x-api-key header. Authenticated requests
// also need Authorization: Bearer <jwt> from POST ${baseUrl}/auth/google.

const BASE_URL = "${baseUrl}";
const API_KEY = "${apiKey}";

async function listTickets(jwt) {
  const res = await fetch(\`\${BASE_URL}/tickets\`, {
    headers: {
      'x-api-key': API_KEY,
      'Authorization': \`Bearer \${jwt}\`,
    },
  });
  return res.json();
}
`;
}

function snippetFor(platform: Platform, apiKey: string, appId: string, baseUrl: string): string {
  switch (platform) {
    case "android": return androidSnippet(apiKey, appId, baseUrl);
    case "flutter": return flutterSnippet(apiKey, appId, baseUrl);
    case "ios": return iosSnippet(apiKey, appId, baseUrl);
    case "react_native": return reactNativeSnippet(apiKey, appId, baseUrl);
    case "web": return webSnippet(apiKey, appId, baseUrl);
  }
}

interface Props {
  apiKey: string;
  appId: string;
  /** Platform hint from the App record — used as the default selection. */
  defaultPlatform?: string | null;
  /** Public base URL the SDK should point at. Defaults to current origin. */
  baseUrl?: string;
}

export default function IntegrationGuide({ apiKey, appId, defaultPlatform, baseUrl }: Props) {
  const initial: Platform =
    (PLATFORMS.find((p) => p.value === (defaultPlatform || ""))?.value) || "android";
  const [platform, setPlatform] = useState<Platform>(initial);
  const [copied, setCopied] = useState(false);

  const resolvedBase = baseUrl || (typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : "https://your-server.com/api");
  const code = snippetFor(platform, apiKey, appId, resolvedBase);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      {/* Platform picker */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PLATFORMS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPlatform(p.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              platform === p.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <span className="mr-1">{p.emoji}</span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div className="relative">
        <pre className="bg-gray-900 text-gray-100 text-[12px] leading-relaxed rounded-lg p-4 overflow-x-auto font-mono">
          <code>{code}</code>
        </pre>
        <button
          onClick={copy}
          className={`absolute top-3 right-3 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
            copied
              ? "bg-emerald-500 text-white"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Quick reference */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="font-semibold text-gray-700 mb-0.5">Base URL</div>
          <code className="text-gray-600 break-all">{resolvedBase}</code>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="font-semibold text-gray-700 mb-0.5">API key header</div>
          <code className="text-gray-600">x-api-key</code>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="font-semibold text-gray-700 mb-0.5">Auth header</div>
          <code className="text-gray-600">Authorization: Bearer &lt;jwt&gt;</code>
        </div>
      </div>
    </div>
  );
}
