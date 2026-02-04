/*
  Warnings:

  - You are about to drop the `_ProjectToVolume` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `projectId` to the `Volume` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "_ProjectToVolume_B_index";

-- DropIndex
DROP INDEX "_ProjectToVolume_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_ProjectToVolume";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Volume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "creatorId" INTEGER,
    "projectId" INTEGER NOT NULL,
    "rawDataId" INTEGER,
    CONSTRAINT "Volume_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Volume_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Volume_rawDataId_fkey" FOREIGN KEY ("rawDataId") REFERENCES "RawVolumeData" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Volume" ("creatorId", "description", "id", "name", "rawDataId") SELECT "creatorId", "description", "id", "name", "rawDataId" FROM "Volume";
DROP TABLE "Volume";
ALTER TABLE "new_Volume" RENAME TO "Volume";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
