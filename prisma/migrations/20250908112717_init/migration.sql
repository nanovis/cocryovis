/*
  Warnings:

  - You are about to drop the `_ModelToProject` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `projectId` to the `Model` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "_ModelToProject_B_index";

-- DropIndex
DROP INDEX "_ModelToProject_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_ModelToProject";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Model" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "creatorId" INTEGER,
    "projectId" INTEGER NOT NULL,
    CONSTRAINT "Model_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Model_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Model" ("creatorId", "description", "id", "name") SELECT "creatorId", "description", "id", "name" FROM "Model";
DROP TABLE "Model";
ALTER TABLE "new_Model" RENAME TO "Model";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
