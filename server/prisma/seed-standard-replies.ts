import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const standards = [
  { title: "Thank you for your feedback", body: "Thank you for taking the time to share your feedback! We really appreciate it and will use it to improve our app.", tag: "feedback" },
  { title: "We're working on it", body: "Thanks for reporting this! Our team is currently investigating the issue and we'll have an update for you soon.", tag: "triage" },
  { title: "Issue resolved – please update", body: "Great news! This issue has been resolved in our latest update. Please update the app to the newest version and let us know if the problem persists.", tag: "support" },
  { title: "Need more details", body: "Thank you for reaching out. To help us investigate further, could you please share your device model, OS version, and app version? Any steps to reproduce the issue would also be helpful.", tag: "triage" },
  { title: "Feature noted for roadmap", body: "Thanks for the suggestion! We've added this to our feature roadmap and will consider it in an upcoming release. Stay tuned for updates!", tag: "feedback" },
  { title: "Sorry for the inconvenience", body: "We sincerely apologize for the trouble you've experienced. Our team is working hard to make sure this doesn't happen again. Thank you for your patience.", tag: "support" },
  { title: "Try clearing app cache", body: "Please try clearing the app cache (Settings → Apps → [App name] → Clear Cache) and restart the app. This resolves many common issues. Let us know if it helps!", tag: "support" },
  { title: "Closing – issue resolved", body: "We're glad to hear the issue has been resolved! We're closing this ticket for now. Please don't hesitate to reach out if you run into anything else.", tag: "support" },
];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@feedback.app";
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    console.error(`Admin user not found: ${adminEmail}`);
    process.exit(1);
  }

  let created = 0;
  for (const s of standards) {
    const exists = await prisma.cannedReply.findFirst({
      where: { ownerId: admin.id, title: s.title, locale: null },
    });
    if (!exists) {
      await prisma.cannedReply.create({
        data: { ownerId: admin.id, title: s.title, body: s.body, shared: true, tag: s.tag, locale: null },
      });
      console.log(`✓ Created: ${s.title}`);
      created++;
    } else {
      console.log(`– Exists:  ${s.title}`);
    }
  }
  console.log(`\nDone. Created ${created} of ${standards.length} standard replies.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
