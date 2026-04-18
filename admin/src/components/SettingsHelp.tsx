import { useState } from "react";

/**
 * Inline help panel for the app Settings section. Collapsible, compact, and
 * scoped to "what each field means and where to get it" — not a full
 * integration guide (that's handled elsewhere).
 *
 * Each topic is one expandable card. Default-closed so the Settings form
 * itself stays the primary focus.
 */

type Topic = {
  key: string;
  title: string;
  description: string;
  body: React.ReactNode;
};

const TOPICS: Topic[] = [
  {
    key: "google",
    title: "Google Client ID",
    description: "Required for Google Sign-In in the mobile app.",
    body: (
      <div className="space-y-2 text-xs text-gray-700">
        <p>
          Open the{" "}
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            Google Cloud Console → Credentials
          </a>{" "}
          and create an OAuth client.
        </p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>
            Pick the <strong>Web application</strong> type — <em>not</em> Android or iOS.
            The mobile SDK needs a Web client ID to verify sign-in tokens server-side.
          </li>
          <li>
            In Flutter pass it as <code className="bg-gray-100 px-1 rounded">GoogleSignIn(serverClientId: '…')</code>.
          </li>
          <li>
            Apps published under different Google accounts each need their own Web Client ID.
          </li>
        </ul>
      </div>
    ),
  },
  {
    key: "email",
    title: "Email (sender + SMTP)",
    description: "Controls how ticket and feedback notifications are sent.",
    body: (
      <div className="space-y-2 text-xs text-gray-700">
        <p>
          <strong>Sender email</strong> and <strong>Sender name</strong> control the "from" address of every
          email sent to users of this app. <strong>SMTP settings</strong> are optional — if you leave them
          blank, the server's global SMTP config handles delivery.
        </p>
        <p className="font-semibold text-gray-800">Common SMTP presets:</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>
            <strong>Gmail:</strong> host <code className="bg-gray-100 px-1 rounded">smtp.gmail.com</code>,
            port <code className="bg-gray-100 px-1 rounded">587</code>, auth with an{" "}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">App Password</a>
            {" "}(not your login password)
          </li>
          <li>
            <strong>Outlook:</strong> <code className="bg-gray-100 px-1 rounded">smtp-mail.outlook.com</code>, port 587
          </li>
          <li>
            <strong>Custom domain:</strong> <code className="bg-gray-100 px-1 rounded">mail.yourdomain.com</code>,
            port <code className="bg-gray-100 px-1 rounded">587</code> (TLS) or <code className="bg-gray-100 px-1 rounded">465</code> (SSL)
          </li>
        </ul>
      </div>
    ),
  },
  {
    key: "firebase",
    title: "Push notifications (Firebase)",
    description: "Required to send push to devices and broadcast announcements.",
    body: (
      <div className="space-y-2 text-xs text-gray-700">
        <ol className="list-decimal list-inside space-y-1 pl-1">
          <li>
            Open the{" "}
            <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              Firebase Console
            </a>{" "}
            and pick the project tied to this app.
          </li>
          <li>
            Go to <strong>Project Settings → Service accounts → Generate new private key</strong>. You'll get a JSON file.
          </li>
          <li>
            Paste three fields from that JSON into the form: <code className="bg-gray-100 px-1 rounded">project_id</code>,{" "}
            <code className="bg-gray-100 px-1 rounded">client_email</code>, and{" "}
            <code className="bg-gray-100 px-1 rounded">private_key</code>.
          </li>
          <li>
            Click <strong>Validate credentials</strong> to confirm the service account works, then{" "}
            <strong>Send test push to my device</strong> to verify end-to-end delivery.
          </li>
        </ol>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800">
          <strong>Keep the private key secret.</strong> Each app on a different Firebase project needs its own credentials.
        </div>
      </div>
    ),
  },
  {
    key: "bundle",
    title: "Bundle ID / Package Name",
    description: "Identifies your app on the device — only needed for debugging and cross-reference.",
    body: (
      <div className="space-y-2 text-xs text-gray-700">
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>
            <strong>Android:</strong> <code className="bg-gray-100 px-1 rounded">android/app/build.gradle</code> →{" "}
            <code className="bg-gray-100 px-1 rounded">applicationId</code> (e.g. <code className="bg-gray-100 px-1 rounded">com.cpctech.signaturemakerpro</code>).
          </li>
          <li>
            <strong>iOS:</strong> Xcode → Target → General → <strong>Bundle Identifier</strong>.
          </li>
          <li>
            <strong>Flutter:</strong> same as Android <code className="bg-gray-100 px-1 rounded">applicationId</code>.
          </li>
        </ul>
      </div>
    ),
  },
  {
    key: "apikey",
    title: "API Key",
    description: "Passed by the SDK as x-api-key on every request.",
    body: (
      <div className="space-y-2 text-xs text-gray-700">
        <p>
          Copy the key from the <strong>API key</strong> card above and pass it to{" "}
          <code className="bg-gray-100 px-1 rounded">FeedbackSDK.initialize(…, apiKey = "…")</code>.
        </p>
        <p>
          <strong>Regenerating</strong> invalidates the old key immediately — every installed copy of the
          app with the old key will fail authentication until you ship a build with the new one.
        </p>
      </div>
    ),
  },
];

export default function SettingsHelp() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {TOPICS.map((t) => {
        const isOpen = open === t.key;
        return (
          <div
            key={t.key}
            className={`rounded-lg border transition-colors ${
              isOpen ? "border-blue-200 bg-blue-50/30" : "border-gray-200 bg-white"
            }`}
          >
            <button
              onClick={() => setOpen(isOpen ? null : t.key)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <svg
                className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{t.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
              </div>
            </button>
            {isOpen && <div className="px-4 pb-4 pl-11 border-t border-blue-100 pt-3">{t.body}</div>}
          </div>
        );
      })}
    </div>
  );
}
