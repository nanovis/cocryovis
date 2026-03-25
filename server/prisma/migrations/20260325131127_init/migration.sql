/*
  Warnings:

  - You are about to drop the column `reconstructionParameters` on the `Volume` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RawVolumeData" ADD COLUMN "reconstructionParameters" JSONB;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Volume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "physicalUnit" TEXT NOT NULL DEFAULT 'PIXEL',
    "physicalSizeX" REAL NOT NULL DEFAULT 1,
    "physicalSizeY" REAL NOT NULL DEFAULT 1,
    "physicalSizeZ" REAL NOT NULL DEFAULT 1,
    "creatorId" INTEGER,
    "projectId" INTEGER NOT NULL,
    CONSTRAINT "Volume_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Volume_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Volume" ("creatorId", "description", "id", "name", "physicalSizeX", "physicalSizeY", "physicalSizeZ", "physicalUnit", "projectId") SELECT "creatorId", "description", "id", "name", "physicalSizeX", "physicalSizeY", "physicalSizeZ", "physicalUnit", "projectId" FROM "Volume";
DROP TABLE "Volume";
ALTER TABLE "new_Volume" RENAME TO "Volume";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
