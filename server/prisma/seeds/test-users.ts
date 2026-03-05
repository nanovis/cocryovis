import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { securityConfig } from "../../src/tools/config.mjs";

const prisma = new PrismaClient();

async function createUser(username: string, password: string) {
  const bcryptCost = securityConfig.bcryptCost;
  const existing = await prisma.user.findUnique({
    where: { username },
  });

  if (existing) {
    console.log(`↩️ ${username} already exists`);
    return;
  }

  const passwordSalt = await bcrypt.genSalt(bcryptCost);
  const passwordHash = await bcrypt.hash(password, passwordSalt);

  await prisma.user.create({
    data: {
      username: username,
      name: username,
      email: `${username}@example.com`,
      passwordSalt,
      passwordHash,
      admin: false,
    },
  });

  console.log(`✅ Created ${username}`);
}

async function main() {
  try {
    await createUser("test", "testtest");
  } catch (error) {
    console.error("Error creating test user:", error);
  }

  for (let i = 1; i <= 10; i++) {
    const username = `testuser-${i.toString()}`;
    const password = "test123";

    try {
      await createUser(username, password);
    } catch (error) {
      console.error(`Error creating ${username}:`, error);
    }
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
