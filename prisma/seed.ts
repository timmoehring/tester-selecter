import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);
  const cpmPassword = await bcrypt.hash("cpm123", 12);

  await prisma.user.upsert({
    where: { email: "admin@centercode.com" },
    update: {},
    create: {
      email: "admin@centercode.com",
      name: "Admin User",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "cpm@centercode.com" },
    update: {},
    create: {
      email: "cpm@centercode.com",
      name: "CPM User",
      passwordHash: cpmPassword,
      role: "CPM",
    },
  });

  console.log("Seed data created successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
