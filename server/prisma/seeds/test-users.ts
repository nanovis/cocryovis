import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { securityConfig } from "../../src/tools/config.mjs";

const prisma = new PrismaClient();

async function main() {
  const bcryptCost = securityConfig.bcryptCost;

  for (let i = 1; i <= 10; i++) {
    const username = `testuser-${i.toString()}`;
    const password = "test123";

    const existing = await prisma.user.findUnique({
      where: { username },
    });

    if (existing) {
      console.log(`↩️ ${username} already exists`);
      continue;
    }

    const passwordSalt = await bcrypt.genSalt(bcryptCost);
    const passwordHash = await bcrypt.hash(password, passwordSalt);

    await prisma.user.create({
      data: {
        username,
        name: `Test User ${i.toString()}`,
        email: `${username}@example.com`,
        passwordSalt,
        passwordHash,
        admin: false,
      },
    });

    console.log(`✅ Created ${username}`);
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
