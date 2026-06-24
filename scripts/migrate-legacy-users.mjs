import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadGameData } from "@forge-master/game-data";
import { normalizeOneVcianProfile, manualProfile } from "@forge-master/simulator";

const prisma = new PrismaClient();
const dataFile = process.env.LEGACY_DATA_FILE || path.resolve(process.cwd(), "data", "users.json");

async function main() {
  const raw = JSON.parse(await fs.readFile(dataFile, "utf8"));
  const gameData = await loadGameData();
  const users = Object.values(raw.users || {});
  let migrated = 0;

  for (const legacy of users) {
    if (!legacy.username || !legacy.salt || !legacy.passwordHash) continue;
    const user = await prisma.user.upsert({
      where: { username: legacy.username },
      create: {
        username: legacy.username,
        salt: legacy.salt,
        passwordHash: legacy.passwordHash,
        createdAt: legacy.createdAt ? new Date(legacy.createdAt) : new Date(),
        updatedAt: legacy.updatedAt ? new Date(legacy.updatedAt) : new Date()
      },
      update: {
        salt: legacy.salt,
        passwordHash: legacy.passwordHash
      }
    });

    if (legacy.profile) {
      const looksLikeOneVcian = legacy.profile.items && legacy.profile.techTree;
      const normalized = looksLikeOneVcian
        ? normalizeOneVcianProfile(legacy.profile, gameData)
        : manualProfile(`Legacy ${legacy.username}`, gameData, [{ severity: "warning", code: "legacy_shape", message: "Ancien profil non reconnu, conservé en brut." }]);
      await prisma.profile.create({
        data: {
          userId: user.id,
          name: normalized.name || `Legacy ${legacy.username}`,
          source: "legacy",
          rawProfile: legacy.profile,
          normalized,
          dataVersion: normalized.dataVersion,
          confidence: normalized.confidence
        }
      });
    }
    migrated += 1;
  }

  console.log(`Migrated ${migrated} users from ${dataFile}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
