import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@feedback.app";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  const hashedPassword = await bcrypt.hash(password, 10);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashedPassword,
      name: "Super Admin",
      role: "super_admin",
    },
  });

  console.log(`Super admin created: ${admin.email}`);
  console.log("Change the password after first login!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
