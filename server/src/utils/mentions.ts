import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Scan text for @-mentions and resolve them to admin users. Matches @word (one
 * or more word chars, dashes, or dots) case-insensitively against the admin's
 * name, name-without-spaces, or email local part. Bare @here / @everyone could
 * be added later but are skipped for now — we don't want a noisy ping surface.
 *
 * Returns the unique set of resolved admin user IDs.
 */
export async function resolveMentions(body: string): Promise<string[]> {
  const tokens = Array.from(body.matchAll(/@([a-zA-Z0-9._-]+)/g), (m) => m[1].toLowerCase());
  if (tokens.length === 0) return [];

  const admins = await prisma.user.findMany({
    where: { role: { in: ["admin", "super_admin"] } },
    select: { id: true, name: true, email: true },
  });

  const resolved = new Set<string>();
  for (const token of tokens) {
    for (const a of admins) {
      const nameLower = a.name.toLowerCase();
      const emailLocal = a.email.split("@")[0]?.toLowerCase();
      const collapsed = nameLower.replace(/\s+/g, "");
      if (nameLower === token || collapsed === token || emailLocal === token) {
        resolved.add(a.id);
        break;
      }
      // First-name match (most natural way people @ people): split on space.
      const firstName = nameLower.split(" ")[0];
      if (firstName && firstName === token) {
        resolved.add(a.id);
        break;
      }
    }
  }
  return Array.from(resolved);
}
