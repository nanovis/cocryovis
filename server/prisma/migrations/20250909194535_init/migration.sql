/*
  Warnings:

  - You are about to drop the `_ResultToVolume` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `volumeId` to the `Result` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "_ResultToVolume_B_index";

-- DropIndex
DROP INDEX "_ResultToVolume_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_ResultToVolume";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Result" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "folderPath" TEXT,
    "rawVolumeChannel" INTEGER,
    "logFile" TEXT,
    "creatorId" INTEGER,
    "checkpointId" INTEGER NOT NULL,
    "volumeDataId" INTEGER NOT NULL,
    "volumeId" INTEGER NOT NULL,
    CONSTRAINT "Result_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Result_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Result_volumeDataId_fkey" FOREIGN KEY ("volumeDataId") REFERENCES "RawVolumeData" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Result_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Result" ("checkpointId", "creatorId", "folderPath", "id", "logFile", "rawVolumeChannel", "volumeDataId") SELECT "checkpointId", "creatorId", "folderPath", "id", "logFile", "rawVolumeChannel", "volumeDataId" FROM "Result";
DROP TABLE "Result";
ALTER TABLE "new_Result" RENAME TO "Result";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
