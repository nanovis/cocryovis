/*
  Warnings:

  - You are about to drop the `_CheckpointToModel` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `modelId` to the `Checkpoint` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "_CheckpointToModel_B_index";

-- DropIndex
DROP INDEX "_CheckpointToModel_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_CheckpointToModel";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Checkpoint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filePath" TEXT,
    "folderPath" TEXT,
    "creatorId" INTEGER,
    "modelId" INTEGER NOT NULL,
    CONSTRAINT "Checkpoint_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Checkpoint_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Checkpoint" ("creatorId", "filePath", "folderPath", "id") SELECT "creatorId", "filePath", "folderPath", "id" FROM "Checkpoint";
DROP TABLE "Checkpoint";
ALTER TABLE "new_Checkpoint" RENAME TO "Checkpoint";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
