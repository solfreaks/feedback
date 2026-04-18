/**
 * Re-runnable mojibake repair for already-imported legacy rows.
 *
 * Usage:
 *   npx tsx scripts/repair-mojibake.ts \
 *     --api-key=fb_edf412b1affd4e47b27d2ae812c21465 \
 *     --dry-run        # or omit for real writes
 *
 * Safe to re-run: the decoder heuristic only touches strings that look like
 * cp1252-misencoded UTF-8, and bails if the round-trip isn't sane.
 *
 * Scope:
 *   - User.name         (all legacy users imported for this app's activity)
 *   - Feedback.comment  (scoped by --api-key → app)
 *   - FeedbackReply.body
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match ? match.split("=").slice(1).join("=") : undefined;
}
const API_KEY = arg("api-key");
const DRY_RUN = process.argv.includes("--dry-run");

if (!API_KEY) {
  console.error("Missing --api-key=<fb_...>");
  process.exit(1);
}

// ── Decoder (same as import script) ─────────────────────────────────────────

const CP1252_TO_BYTE: Record<number, number> = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
  0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
  0x017E: 0x9E, 0x0178: 0x9F,
};

function fixMojibake(s: string | null | undefined): string {
  if (!s) return s ?? "";
  // Quick exit: no chars above 0x7F means ASCII — nothing to fix.
  if (!/[^\x00-\x7F]/.test(s)) return s;

  // Try to reverse the cp1252 round-trip. If any char is outside both latin1
  // and the cp1252 0x80-0x9F range, the string isn't actually mojibake — bail.
  const bytes = Buffer.alloc(s.length * 2);
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0xFF) {
      bytes[n++] = cp;
    } else if (CP1252_TO_BYTE[cp] !== undefined) {
      bytes[n++] = CP1252_TO_BYTE[cp];
    } else {
      // e.g. already-correct Cyrillic/Arabic/CJK char — pass through.
      return s;
    }
  }
  const decoded = bytes.slice(0, n).toString("utf8");
  // A good decode should have fewer replacement chars than the input had
  // "suspicious" chars (a bad decode replaces everything).
  const replacementCount = (decoded.match(/\uFFFD/g) || []).length;
  if (replacementCount > decoded.length / 4) return s;
  if (decoded.length < 1) return s;
  return decoded;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const app = await prisma.app.findUnique({ where: { apiKey: API_KEY! } });
  if (!app) throw new Error(`No app with apiKey ${API_KEY}`);
  console.log(`Target app: ${app.name} (${app.id})`);
  if (DRY_RUN) console.log("— DRY RUN: no writes, sampling only\n");

  let feedbackFixed = 0;
  let feedbackSkipped = 0;
  const feedbacks = await prisma.feedback.findMany({
    where: { appId: app.id },
    select: { id: true, comment: true },
  });
  for (const f of feedbacks) {
    if (!f.comment) continue;
    const fixed = fixMojibake(f.comment);
    if (fixed === f.comment) {
      feedbackSkipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`fb ${f.id.slice(0, 8)}: ${f.comment.slice(0, 40)}  →  ${fixed.slice(0, 40)}`);
    } else {
      await prisma.feedback.update({ where: { id: f.id }, data: { comment: fixed } });
    }
    feedbackFixed++;
  }
  console.log(`Feedback: ${feedbackFixed} fixed, ${feedbackSkipped} unchanged`);

  let replyFixed = 0;
  let replySkipped = 0;
  // Replies don't carry appId directly; scope via their parent feedback.
  const replies = await prisma.feedbackReply.findMany({
    where: { feedback: { appId: app.id } },
    select: { id: true, body: true },
  });
  for (const r of replies) {
    if (!r.body) continue;
    const fixed = fixMojibake(r.body);
    if (fixed === r.body) {
      replySkipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`reply ${r.id.slice(0, 8)}: ${r.body.slice(0, 40)}  →  ${fixed.slice(0, 40)}`);
    } else {
      await prisma.feedbackReply.update({ where: { id: r.id }, data: { body: fixed } });
    }
    replyFixed++;
  }
  console.log(`Replies: ${replyFixed} fixed, ${replySkipped} unchanged`);

  // Users: repair only users linked to this app via any activity path.
  let userFixed = 0;
  let userSkipped = 0;
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { feedbacks: { some: { appId: app.id } } },
        { tickets: { some: { appId: app.id } } },
        { deviceTokens: { some: { appId: app.id } } },
      ],
    },
    select: { id: true, name: true },
  });
  for (const u of users) {
    if (!u.name) continue;
    const fixed = fixMojibake(u.name);
    if (fixed === u.name) {
      userSkipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`user ${u.id.slice(0, 8)}: ${u.name}  →  ${fixed}`);
    } else {
      await prisma.user.update({ where: { id: u.id }, data: { name: fixed } });
    }
    userFixed++;
  }
  console.log(`Users (linked to this app): ${userFixed} fixed, ${userSkipped} unchanged`);

  console.log("\nDone.");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
