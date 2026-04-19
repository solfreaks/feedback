/**
 * Backfill `Feedback.legacyId` from the `[legacy:fbN]` markers that the
 * import script embedded into each row's `comment`.
 *
 * Idempotent: only updates rows where legacyId is still null. Skips any
 * marker that would collide with an existing legacyId (unique constraint
 * would reject it anyway — we just log and move on).
 *
 * Run once on prod after the migration lands. Repeat runs are safe.
 *
 *   npx tsx scripts/backfill-feedback-legacy-id.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Use $queryRawUnsafe so MySQL's LIKE sees the literal `[legacy:fb` — some
  // Prisma versions escape bracket chars through the query engine and then
  // no rows match even when the data has the markers. Raw SQL sidesteps it.
  const rows = await prisma.$queryRawUnsafe<{ id: string; comment: string | null }[]>(
    "SELECT id, comment FROM feedbacks WHERE legacy_id IS NULL AND comment LIKE '%[legacy:fb%'"
  );
  console.log(`Found ${rows.length} feedback rows with legacy markers`);

  const seen = new Set<number>();
  let updated = 0;
  let skipped = 0;

  for (const r of rows) {
    const m = (r.comment || "").match(/\[legacy:fb(\d+)\]/);
    if (!m) continue;
    const legacyId = parseInt(m[1], 10);
    if (!Number.isFinite(legacyId)) continue;
    if (seen.has(legacyId)) {
      // Duplicate markers in the data — keep only the first.
      console.warn(`duplicate marker fb${legacyId} on ${r.id}, skipping`);
      skipped++;
      continue;
    }
    seen.add(legacyId);

    try {
      await prisma.feedback.update({
        where: { id: r.id },
        data: { legacyId },
      });
      updated++;
    } catch (err: any) {
      // Another row already owns this legacyId — unique constraint fired.
      console.warn(`could not set legacyId=${legacyId} on ${r.id}: ${err.code || err.message}`);
      skipped++;
    }
  }

  console.log(`Updated ${updated}, skipped ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
