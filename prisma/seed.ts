import "dotenv/config";
// prisma/seed.ts
import { hashPassword } from "better-auth/crypto";
import prisma from "../lib/prisma";


async function main() {
  // Step 1 — Create roles
  const customerRole = await prisma.role.upsert({
    where: { name: "customer" },
    update: {},
    create: { name: "customer", description: "Default role for registered users" },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: { name: "admin", description: "Full system access" },
  });

  console.log("✓ Roles seeded:", customerRole.name, adminRole.name);

  // Step 2 — Create admin user
  const existing = await prisma.user.findUnique({
    where: { email: "admin@gadgetbroo.com" },
  });

  if (!existing) {
    const hashedPassword = await hashPassword("Admin@1234!");
    
    // Create User directly in DB to bypass API header requirements
    const user = await prisma.user.create({
      data: {
        id: "admin-user",
        name: "Admin",
        email: "admin@gadgetbroo.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        roleId: adminRole.id
      }
    });

    // Create corresponding credential account
    await prisma.account.create({
      data: {
        id: "admin-account",
        accountId: "admin-user",
        providerId: "credential",
        userId: user.id,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });

    console.log("✓ Admin user seeded");
  } else {
    console.log("⚠ Admin already exists, skipping");
  }

  // Step 3 - Seed Store Settings
  const settings = await prisma.storeSettings.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      contactEmail: "mahamudul.dev@gmail.com",
      contactPhone: "+8801881835612",
      contactAddress: "Brothers Computer Zone, Sachibunia Bazar, Lobonchora,\nKhulna",
    },
  });
  console.log("✓ Store Settings seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
