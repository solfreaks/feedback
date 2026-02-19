import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

function randomDate(daysBack: number) {
  return new Date(Date.now() - Math.random() * daysBack * 24 * 60 * 60 * 1000);
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("Seeding database...\n");

  // 1. Create super admin
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@feedback.app" },
    update: {},
    create: {
      email: "admin@feedback.app",
      password: hashedPassword,
      name: "Super Admin",
      role: "super_admin",
    },
  });
  console.log(`Super admin: admin@feedback.app / admin123`);

  // 2. Create another admin
  const admin2 = await prisma.user.upsert({
    where: { email: "sarah@feedback.app" },
    update: {},
    create: {
      email: "sarah@feedback.app",
      password: hashedPassword,
      name: "Sarah Chen",
      role: "admin",
    },
  });
  console.log(`Admin: sarah@feedback.app / admin123`);

  // 3. Create apps
  const appNames = ["ShopEase", "FitTracker Pro", "NoteSync", "QuickPay", "PhotoVault"];
  const apps = [];
  for (const name of appNames) {
    const app = await prisma.app.upsert({
      where: { apiKey: `fb_${name.toLowerCase().replace(/\s+/g, "")}` },
      update: {},
      create: {
        name,
        apiKey: `fb_${name.toLowerCase().replace(/\s+/g, "")}`,
      },
    });
    apps.push(app);
  }
  console.log(`Created ${apps.length} apps: ${appNames.join(", ")}`);

  // 4. Create users
  const userDetails = [
    { name: "John Smith", email: "john.smith@gmail.com", googleId: "g_001" },
    { name: "Emily Johnson", email: "emily.j@gmail.com", googleId: "g_002" },
    { name: "Michael Brown", email: "m.brown@outlook.com", googleId: "g_003" },
    { name: "Jessica Davis", email: "jdavis@gmail.com", googleId: "g_004" },
    { name: "David Wilson", email: "d.wilson@yahoo.com", googleId: "g_005" },
    { name: "Ashley Martinez", email: "ashley.m@gmail.com", googleId: "g_006" },
    { name: "James Taylor", email: "jtaylor@gmail.com", googleId: "g_007" },
    { name: "Amanda Anderson", email: "amanda.a@outlook.com", googleId: "g_008" },
    { name: "Robert Thomas", email: "rthomas@gmail.com", googleId: "g_009" },
    { name: "Sophia Jackson", email: "sophia.j@gmail.com", googleId: "g_010" },
    { name: "Daniel White", email: "d.white@yahoo.com", googleId: "g_011" },
    { name: "Olivia Harris", email: "olivia.h@gmail.com", googleId: "g_012" },
    { name: "William Clark", email: "w.clark@outlook.com", googleId: "g_013" },
    { name: "Isabella Lewis", email: "isa.lewis@gmail.com", googleId: "g_014" },
    { name: "Alexander Walker", email: "a.walker@gmail.com", googleId: "g_015" },
  ];

  const users = [];
  for (const u of userDetails) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        googleId: u.googleId,
        email: u.email,
        name: u.name,
        role: "user",
        lastActiveAt: randomDate(7),
      },
    });
    users.push(user);
  }
  console.log(`Created ${users.length} users`);

  // Ban one user
  await prisma.user.update({ where: { email: "d.white@yahoo.com" }, data: { isBanned: true } });

  // 5. Create categories per app
  const categoryNames = ["Login Issues", "Payment Problems", "UI/UX", "Performance", "Feature Request", "Account", "Sync Issues"];
  for (const app of apps) {
    for (const catName of categoryNames.slice(0, 4 + Math.floor(Math.random() * 3))) {
      await prisma.category.upsert({
        where: { appId_name: { appId: app.id, name: catName } },
        update: {},
        create: { appId: app.id, name: catName },
      });
    }
  }
  console.log(`Created categories for each app`);

  // 6. Create tickets
  const ticketTitles = [
    { title: "App crashes on login", desc: "The app crashes immediately after entering credentials and tapping the login button. Happens every time on Android 14.", priority: "critical" as const },
    { title: "Payment not processing", desc: "Tried to make a purchase but the payment keeps failing. Card is valid and has sufficient funds. Error code: PAY_001.", priority: "high" as const },
    { title: "Dark mode colors are wrong", desc: "Some text is barely visible in dark mode. Specifically the product description and price labels are dark text on dark background.", priority: "medium" as const },
    { title: "Slow loading on home screen", desc: "Home screen takes 8-10 seconds to load. Used to be instant. Started happening after the last update.", priority: "high" as const },
    { title: "Cannot upload profile picture", desc: "When I try to upload a profile picture from my gallery, nothing happens. No error message shown.", priority: "medium" as const },
    { title: "Push notifications not working", desc: "I'm not receiving any push notifications even though they're enabled in settings. Checked phone settings too.", priority: "high" as const },
    { title: "Search results are empty", desc: "Searching for any product returns no results. The search bar accepts input but shows 'No results found' for everything.", priority: "critical" as const },
    { title: "Wishlist items disappeared", desc: "All my saved wishlist items are gone after updating the app. Had about 20 items saved.", priority: "medium" as const },
    { title: "Order history not loading", desc: "The order history page shows a loading spinner forever. I need to check my recent orders.", priority: "low" as const },
    { title: "Two-factor auth code not received", desc: "SMS verification code never arrives. Tried multiple times. My phone number is correct.", priority: "high" as const },
    { title: "Feature request: Export data", desc: "Would be great to export my workout data to CSV or connect with Google Fit.", priority: "low" as const },
    { title: "Sync issues between devices", desc: "Notes edited on my phone don't show up on my tablet. Sync seems broken.", priority: "high" as const },
    { title: "Memory leak causing crashes", desc: "App gets slower over time and eventually crashes. Need to restart phone to fix it.", priority: "critical" as const },
    { title: "Incorrect currency display", desc: "Prices are showing in USD instead of my local currency (EUR). Region is set correctly.", priority: "medium" as const },
    { title: "Cannot cancel subscription", desc: "The cancel button in subscription settings does nothing when tapped. No error shown.", priority: "high" as const },
    { title: "Biometric login stopped working", desc: "Fingerprint authentication no longer works after the latest update. Was working fine before.", priority: "medium" as const },
    { title: "Images not loading in chat", desc: "All images in chat messages show as broken image icons. Text messages work fine.", priority: "medium" as const },
    { title: "Wrong notification sounds", desc: "All notifications play the same sound regardless of type. Used to be different sounds for different events.", priority: "low" as const },
    { title: "App freezes on checkout", desc: "The app completely freezes when I tap 'Place Order'. Have to force close and restart.", priority: "critical" as const },
    { title: "Calendar widget not updating", desc: "The home screen widget shows yesterday's date and doesn't update automatically.", priority: "low" as const },
    { title: "Crash when opening settings", desc: "Settings page crashes immediately on open. Can't change any preferences.", priority: "high" as const },
    { title: "Data not backing up to cloud", desc: "Auto-backup hasn't run in 2 weeks despite being enabled. Manual backup also fails.", priority: "medium" as const },
    { title: "Receipt generation broken", desc: "Download receipt button generates a blank PDF. Need receipts for expense reports.", priority: "medium" as const },
    { title: "Location services draining battery", desc: "App uses GPS continuously in background. Battery drops 30% in 2 hours even with app closed.", priority: "high" as const },
    { title: "Accessibility issues with VoiceOver", desc: "Many buttons and labels are not properly labeled for screen readers. App is unusable with VoiceOver.", priority: "medium" as const },
  ];

  const statuses = ["open", "in_progress", "resolved", "closed"] as const;
  const assignees = [admin.id, admin2.id, null, null];

  const tickets = [];
  for (let i = 0; i < ticketTitles.length; i++) {
    const t = ticketTitles[i];
    const createdAt = randomDate(30);
    const statusVal = randomItem(statuses);
    const assignedTo = statusVal === "open" ? (Math.random() > 0.7 ? randomItem([admin.id, admin2.id]) : null) : randomItem(assignees);

    const slaHours: Record<string, number> = { critical: 4, high: 24, medium: 72, low: 168 };
    const slaDeadline = new Date(createdAt.getTime() + slaHours[t.priority] * 60 * 60 * 1000);

    const ticket = await prisma.ticket.create({
      data: {
        appId: randomItem(apps).id,
        userId: randomItem(users).id,
        title: t.title,
        description: t.desc,
        category: randomItem(categoryNames),
        priority: t.priority,
        status: statusVal,
        assignedTo,
        slaDeadline,
        createdAt,
      },
    });
    tickets.push(ticket);
  }
  console.log(`Created ${tickets.length} tickets`);

  // 7. Create comments on tickets
  const commentTexts = [
    "Thanks for reporting this. We're looking into it.",
    "Can you provide your device model and OS version?",
    "I'm experiencing the same issue on my Pixel 7.",
    "This has been escalated to the development team.",
    "We've identified the root cause. A fix is in progress.",
    "This should be resolved in the next update (v2.5.1).",
    "I've tried clearing the cache and it fixed the issue for me.",
    "Still happening after the latest update. Any progress on this?",
    "The fix has been deployed. Please update to the latest version.",
    "Confirmed working now. Thank you for the quick fix!",
    "Adding more details: this only happens on WiFi, not on mobile data.",
    "We've added this to our roadmap for Q2.",
  ];
  const internalNotes = [
    "Reproduced on staging. Linked to commit abc123.",
    "Root cause: database connection pool exhaustion under load.",
    "Customer is a premium subscriber - prioritize.",
    "Related to ticket #45. Same underlying issue.",
  ];

  let commentCount = 0;
  for (const ticket of tickets) {
    const numComments = Math.floor(Math.random() * 5);
    for (let c = 0; c < numComments; c++) {
      const isInternal = Math.random() > 0.8;
      await prisma.ticketComment.create({
        data: {
          ticketId: ticket.id,
          userId: isInternal ? randomItem([admin.id, admin2.id]) : randomItem([...users.map(u => u.id), admin.id, admin2.id]),
          body: isInternal ? randomItem(internalNotes) : randomItem(commentTexts),
          isInternalNote: isInternal,
          createdAt: new Date(new Date(ticket.createdAt).getTime() + (c + 1) * 3600000 * Math.random() * 48),
        },
      });
      commentCount++;
    }
  }
  console.log(`Created ${commentCount} comments`);

  // 8. Create ticket history entries
  let historyCount = 0;
  for (const ticket of tickets) {
    if (ticket.status !== "open") {
      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          changedBy: randomItem([admin.id, admin2.id]),
          field: "status",
          oldValue: "open",
          newValue: ticket.status,
          createdAt: new Date(new Date(ticket.createdAt).getTime() + 86400000 * Math.random()),
        },
      });
      historyCount++;
    }
    if (ticket.assignedTo) {
      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          changedBy: admin.id,
          field: "assignedTo",
          oldValue: null,
          newValue: ticket.assignedTo,
          createdAt: new Date(new Date(ticket.createdAt).getTime() + 3600000 * Math.random()),
        },
      });
      historyCount++;
    }
  }
  console.log(`Created ${historyCount} history entries`);

  // 9. Create feedbacks
  const feedbackComments = [
    "Great app! Really love the clean design and easy navigation.",
    "The new update is amazing. So much faster than before!",
    "Decent app but could use more customization options.",
    "Crashes too often. Please fix the stability issues.",
    "Love the dark mode feature! Makes it much easier on the eyes.",
    "Payment process is too slow. Needs optimization.",
    "Best app in its category. Highly recommended!",
    "UI is confusing. Took me a while to figure out how to navigate.",
    "Would love to see a widget for the home screen.",
    "Customer support was very helpful when I had an issue.",
    "App drains battery too quickly when running in background.",
    "The search feature is incredibly fast and accurate.",
    "Missing some basic features that competitors have.",
    "Awesome updates recently! Keep up the great work.",
    "The onboarding experience could be better.",
    "Very reliable app. Never had any issues in 6 months of use.",
    "Please add support for multiple languages.",
    "The export feature saved me hours of work. Thank you!",
    "Notifications are too frequent and annoying.",
    "Smooth and intuitive. Even my parents can use it easily.",
    "Had trouble with login but the support team fixed it quickly.",
    "Would be perfect with offline mode support.",
    "Price is a bit high compared to alternatives.",
    "The charts and analytics are really insightful.",
    "App just keeps getting better with every update!",
    null, null, null, null, null, // some without comments
  ];

  const categories = ["bug_report", "feature_request", "suggestion", "complaint", "general"] as const;
  const ratingWeights = [1, 1, 2, 4, 3]; // more 4-5 star ratings

  function weightedRating(): number {
    const total = ratingWeights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < ratingWeights.length; i++) {
      r -= ratingWeights[i];
      if (r <= 0) return i + 1;
    }
    return 5;
  }

  let feedbackCount = 0;
  for (let i = 0; i < 40; i++) {
    const createdAt = randomDate(45);
    await prisma.feedback.create({
      data: {
        appId: randomItem(apps).id,
        userId: randomItem(users).id,
        rating: weightedRating(),
        category: randomItem(categories),
        comment: randomItem(feedbackComments),
        createdAt,
      },
    });
    feedbackCount++;
  }
  console.log(`Created ${feedbackCount} feedbacks`);

  // 10. Create some feedback replies
  const replyTexts = [
    "Thank you for your feedback! We're glad you enjoy the app.",
    "We appreciate your input. This feature is on our roadmap.",
    "Sorry to hear about your experience. We're working on improvements.",
    "Thanks for the suggestion! We'll definitely consider this.",
    "We've noted your concerns and our team is investigating.",
    "Great to hear! We'll keep improving based on feedback like yours.",
  ];

  const feedbacks = await prisma.feedback.findMany({ take: 15 });
  let replyCount = 0;
  for (const fb of feedbacks) {
    if (Math.random() > 0.4) {
      await prisma.feedbackReply.create({
        data: {
          feedbackId: fb.id,
          userId: randomItem([admin.id, admin2.id]),
          body: randomItem(replyTexts),
          createdAt: new Date(new Date(fb.createdAt).getTime() + 86400000 * (1 + Math.random() * 3)),
        },
      });
      replyCount++;
    }
  }
  console.log(`Created ${replyCount} feedback replies`);

  // 11. Create notifications for admins
  const notificationData = [
    { type: "new_ticket" as const, title: "New Ticket", message: "John Smith created: App crashes on login", link: `/tickets/${tickets[0]?.id}` },
    { type: "new_ticket" as const, title: "New Ticket", message: "Emily Johnson created: Payment not processing", link: `/tickets/${tickets[1]?.id}` },
    { type: "new_feedback" as const, title: "New Feedback", message: "Michael Brown left 5★ feedback", link: `/feedbacks/${feedbacks[0]?.id}` },
    { type: "new_ticket" as const, title: "New Ticket", message: "Jessica Davis created: Search results are empty", link: `/tickets/${tickets[6]?.id}` },
    { type: "new_feedback" as const, title: "New Feedback", message: "David Wilson left 2★ feedback", link: `/feedbacks/${feedbacks[1]?.id}` },
    { type: "new_ticket" as const, title: "New Ticket", message: "Ashley Martinez created: App freezes on checkout", link: `/tickets/${tickets[18]?.id}` },
  ];

  for (const n of notificationData) {
    for (const adminUser of [admin, admin2]) {
      await prisma.notification.create({
        data: {
          userId: adminUser.id,
          type: n.type,
          title: n.title,
          message: n.message,
          link: n.link,
          isRead: Math.random() > 0.5,
          createdAt: randomDate(7),
        },
      });
    }
  }
  console.log(`Created ${notificationData.length * 2} notifications`);

  console.log("\nSeeding complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
