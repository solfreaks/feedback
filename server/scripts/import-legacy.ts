/**
 * One-shot import for the legacy PHP feedback site.
 *
 * Usage:
 *   npx tsx scripts/import-legacy.ts \
 *     --sql=../hhealthc_feedback_db.sql \
 *     --api-key=fb_edf412b1affd4e47b27d2ae812c21465
 *
 * What it does:
 *   1. Reads the legacy MySQL dump file (plain SQL, no live DB needed).
 *   2. Parses INSERT rows for users, feedback, and feedback_replies.
 *   3. Looks up the target App by its x-api-key.
 *   4. Creates new-system rows:
 *        users            → User   (matched by google_id)
 *        feedback         → Feedback (+ an admin FeedbackReply per inline response)
 *        feedback_replies → FeedbackReply
 *   5. Idempotent. Re-run safe: we check by (appId, legacyId) via a deterministic
 *      tag embedded in the comment/reply body.
 *
 * Attachments are logged but NOT imported — paths point to the old server's disk.
 * When you rsync the old uploads folder into server/uploads/, run the script
 * again with --link-attachments to wire them in.
 */

import { PrismaClient, FeedbackCategory, FeedbackStatus } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ── Arg parsing ──────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match ? match.split("=").slice(1).join("=") : undefined;
}

const SQL_PATH = arg("sql") || path.resolve(__dirname, "../../hhealthc_feedback_db.sql");
const API_KEY = arg("api-key");
const DRY_RUN = process.argv.includes("--dry-run");
const LINK_ATTACHMENTS = process.argv.includes("--link-attachments");

if (!API_KEY) {
  console.error("Missing --api-key=<fb_...>");
  process.exit(1);
}

// ── SQL dump parsing ─────────────────────────────────────────────────────────
//
// The dump is a standard mysqldump: `INSERT INTO \`table\` (cols…) VALUES
// (row1), (row2), …;`. We only need a small subset of tables, so we write a
// targeted parser instead of pulling a general SQL library.
//
// The tricky part is splitting rows that contain commas inside quoted strings.
// We tokenize one value at a time, respecting SQL string quoting (single quotes
// doubled for escape, backslash escapes) and NULL.

function parseInsertStatements(sql: string, tableName: string): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  const re = new RegExp(
    `INSERT INTO \`${tableName}\` \\(([^)]+)\\) VALUES([\\s\\S]*?);\\s*$`,
    "gm"
  );

  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    const columns = match[1].split(",").map((c) => c.trim().replace(/`/g, ""));
    const body = match[2];

    // Walk the body one row-tuple at a time. A tuple starts with `(` at top
    // level and ends with the matching `)`.
    let i = 0;
    while (i < body.length) {
      while (i < body.length && body[i] !== "(") i++;
      if (i >= body.length) break;

      const values: (string | null)[] = [];
      let current = "";
      let inString = false;
      i++; // skip opening (

      while (i < body.length) {
        const ch = body[i];

        if (inString) {
          if (ch === "\\") {
            // Handle common escapes: \n, \t, \', \\
            const next = body[i + 1];
            if (next === "n") current += "\n";
            else if (next === "t") current += "\t";
            else if (next === "r") current += "\r";
            else if (next === "0") current += "\0";
            else current += next;
            i += 2;
            continue;
          }
          if (ch === "'") {
            // Doubled single quote is an escape — else end of string.
            if (body[i + 1] === "'") {
              current += "'";
              i += 2;
              continue;
            }
            values.push(current);
            current = "";
            inString = false;
            i++;
            // consume trailing comma or close paren
            while (i < body.length && (body[i] === "," || body[i] === " ")) i++;
            continue;
          }
          current += ch;
          i++;
          continue;
        }

        // Not in a string: look for ", NULL, unquoted number, or opening quote.
        if (ch === "'") { inString = true; i++; continue; }
        if (ch === ")") { i++; break; }
        if (ch === "," || ch === " " || ch === "\n" || ch === "\r" || ch === "\t") { i++; continue; }

        // Unquoted token — read until comma/close-paren.
        let token = "";
        while (i < body.length && body[i] !== "," && body[i] !== ")") {
          token += body[i];
          i++;
        }
        token = token.trim();
        values.push(token.toUpperCase() === "NULL" ? null : token);
      }

      if (values.length === columns.length) {
        const row: Record<string, any> = {};
        columns.forEach((col, idx) => { row[col] = values[idx]; });
        rows.push(row);
      }
    }
  }

  return rows;
}

// ── Field mappers ────────────────────────────────────────────────────────────

function mapCategory(raw: string): FeedbackCategory {
  const s = (raw || "").toLowerCase().trim();
  if (s.includes("bug")) return "bug_report";
  if (s.includes("feature")) return "feature_request";
  if (s.includes("suggestion")) return "suggestion";
  if (s.includes("complaint")) return "complaint";
  return "general";
}

function mapStatus(raw: string): FeedbackStatus {
  // Legacy: new / reviewed / resolved  →  new / acknowledged / resolved
  const s = (raw || "new").toLowerCase().trim();
  if (s === "resolved") return "resolved";
  if (s === "reviewed") return "acknowledged";
  return "new";
}

/**
 * Undo mojibake from phpMyAdmin exports where UTF-8 bytes were stored as if
 * they were latin1 and then re-encoded as UTF-8. Detection: if the string
 * *only* contains characters that look suspicious (Ã/Â/Ø sequences) AND
 * re-decoding produces printable text, use the decoded version. Otherwise
 * pass through untouched so plain ASCII / already-correct UTF-8 isn't harmed.
 */
function fixMojibake(s: string | null | undefined): string {
  if (!s) return s ?? "";
  // Cheap heuristic: any byte > 0x7F that looks like the classic Ã/Â prefix.
  if (!/[\u00C0-\u00FF]{2,}/.test(s)) return s;
  try {
    const roundTrip = Buffer.from(s, "latin1").toString("utf8");
    // Sanity: the round-trip shouldn't introduce replacement chars.
    if (roundTrip.includes("\uFFFD")) return s;
    return roundTrip;
  } catch {
    return s;
  }
}

function parseAttachments(raw: string | null | undefined): string[] {
  if (!raw || raw === "[]" || raw === "null") return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string");
    return [];
  } catch {
    return [];
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Reading ${SQL_PATH}`);
  const sql = fs.readFileSync(SQL_PATH, "utf8");

  const app = await prisma.app.findUnique({ where: { apiKey: API_KEY! } });
  if (!app) throw new Error(`No app with apiKey ${API_KEY}`);
  console.log(`Target app: ${app.name} (${app.id})`);

  const legacyUsers = parseInsertStatements(sql, "users");
  const legacyFeedback = parseInsertStatements(sql, "feedback");
  const legacyReplies = parseInsertStatements(sql, "feedback_replies");

  console.log(`Parsed: ${legacyUsers.length} users, ${legacyFeedback.length} feedback, ${legacyReplies.length} replies`);
  if (DRY_RUN) {
    console.log("--dry-run — no writes. Sample feedback row:", legacyFeedback[0]);
    return;
  }

  // ── Users ────────────────────────────────────────────────────────────────
  // Matched by google_id; if that google_id is already in our users table
  // (from a fresh sign-in post-launch) we leave it alone.
  let userCreated = 0, userSkipped = 0;
  for (const u of legacyUsers) {
    if (!u.google_id || !u.email) continue;
    const existing = await prisma.user.findFirst({
      where: { OR: [{ googleId: u.google_id }, { email: u.email }] },
    });
    if (existing) {
      userSkipped++;
      continue;
    }
    await prisma.user.create({
      data: {
        googleId: u.google_id,
        email: u.email,
        name: fixMojibake(u.display_name) || u.email.split("@")[0] || "Legacy user",
        avatarUrl: u.photo_url || null,
        role: "user",
        isBanned: u.status === "inactive",
        createdAt: u.created_at ? new Date(u.created_at) : new Date(),
      },
    });
    userCreated++;
  }
  console.log(`Users: created ${userCreated}, skipped ${userSkipped} (already existed)`);

  // Build google_id → userId map (now that users exist). We'll need this for
  // the feedback rows and replies.
  const userIdMap = new Map<string, string>();
  const allUsers = await prisma.user.findMany({
    where: { googleId: { in: legacyUsers.map((u) => u.google_id).filter(Boolean) } },
    select: { id: true, googleId: true },
  });
  for (const u of allUsers) if (u.googleId) userIdMap.set(u.googleId, u.id);

  // ── Feedback ─────────────────────────────────────────────────────────────
  // Use a marker in the comment body to detect re-runs: `[legacy:<id>]`.
  let fbCreated = 0, fbSkipped = 0, fbMissingUser = 0;
  const feedbackIdMap = new Map<string, string>(); // legacy feedback_id → new feedback id

  for (const f of legacyFeedback) {
    const userId = userIdMap.get(f.google_id);
    if (!userId) { fbMissingUser++; continue; }

    const marker = `[legacy:fb${f.feedback_id}]`;
    const existing = await prisma.feedback.findFirst({
      where: { appId: app.id, comment: { contains: marker } },
    });
    if (existing) {
      feedbackIdMap.set(f.feedback_id, existing.id);
      fbSkipped++;
      continue;
    }

    const comment = [fixMojibake(f.comments), marker].filter(Boolean).join("\n\n");
    const rating = f.rating ? parseInt(f.rating) : 0;

    const created = await prisma.feedback.create({
      data: {
        appId: app.id,
        userId,
        rating: rating >= 1 && rating <= 5 ? rating : 3,
        category: mapCategory(f.category),
        status: mapStatus(f.status),
        comment,
        createdAt: f.created_at ? new Date(f.created_at) : new Date(),
      },
    });
    feedbackIdMap.set(f.feedback_id, created.id);
    fbCreated++;

    // Legacy inline admin `response` field becomes an admin FeedbackReply.
    if (f.response && f.response.trim()) {
      // We need an admin author — use the first super_admin or admin we can find.
      const adminAuthor = await prisma.user.findFirst({
        where: { role: { in: ["admin", "super_admin"] } },
        orderBy: { createdAt: "asc" },
      });
      if (adminAuthor) {
        await prisma.feedbackReply.create({
          data: {
            feedbackId: created.id,
            userId: adminAuthor.id,
            body: fixMojibake(f.response),
            createdAt: f.created_at ? new Date(f.created_at) : new Date(),
          },
        });
      }
    }

    // Attachments: log only, unless --link-attachments passed.
    const atts = parseAttachments(f.screenshot_url);
    if (atts.length > 0 && LINK_ATTACHMENTS) {
      for (const legacyPath of atts) {
        // Normalize `../uploads/feedback/foo.jpg` → `/uploads/legacy/foo.jpg`.
        const fname = path.basename(legacyPath);
        await prisma.feedbackAttachment.create({
          data: {
            feedbackId: created.id,
            fileUrl: `/uploads/legacy/${fname}`,
            fileName: fname,
            fileSize: 0,
          },
        });
      }
    } else if (atts.length > 0) {
      console.log(`  [${f.feedback_id}] ${atts.length} attachment(s) skipped (no --link-attachments): ${atts.join(", ")}`);
    }
  }
  console.log(`Feedback: created ${fbCreated}, skipped ${fbSkipped}, missing user ${fbMissingUser}`);

  // ── Feedback replies ─────────────────────────────────────────────────────
  let replyCreated = 0, replySkipped = 0, replyMissingParent = 0;
  for (const r of legacyReplies) {
    const newFeedbackId = feedbackIdMap.get(r.feedback_id);
    if (!newFeedbackId) { replyMissingParent++; continue; }

    const marker = `[legacy:fr${r.reply_id}]`;
    const existing = await prisma.feedbackReply.findFirst({
      where: { feedbackId: newFeedbackId, body: { contains: marker } },
    });
    if (existing) { replySkipped++; continue; }

    // Resolve responder. user_role='user' → responder_id is google_id; 'admin'
    // → it's likely an admin username we can't map, so fall back to the first
    // admin user.
    let userId: string | null = null;
    if (r.user_role === "user") {
      userId = userIdMap.get(r.responder_id) || null;
    }
    if (!userId) {
      const admin = await prisma.user.findFirst({
        where: { role: { in: ["admin", "super_admin"] } },
        orderBy: { createdAt: "asc" },
      });
      userId = admin?.id || null;
    }
    if (!userId) {
      console.warn(`  skipping reply ${r.reply_id} — no user resolvable`);
      continue;
    }

    const body = [fixMojibake(r.message), marker].filter(Boolean).join("\n\n");
    await prisma.feedbackReply.create({
      data: {
        feedbackId: newFeedbackId,
        userId,
        body,
        createdAt: r.created_at ? new Date(r.created_at) : new Date(),
      },
    });
    replyCreated++;
  }
  console.log(`Replies: created ${replyCreated}, skipped ${replySkipped}, missing parent ${replyMissingParent}`);

  console.log("\nDone.");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
