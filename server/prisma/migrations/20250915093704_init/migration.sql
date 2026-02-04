/*
  Warnings:

  - You are about to drop the column `volumeDataId` on the `Result` table. All the data in the column will be lost.

*/
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
    "volumeId" INTEGER NOT NULL,
    CONSTRAINT "Result_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Result_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Result_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Result" ("checkpointId", "creatorId", "folderPath", "id", "logFile", "rawVolumeChannel", "volumeId") SELECT "checkpointId", "creatorId", "folderPath", "id", "logFile", "rawVolumeChannel", "volumeId" FROM "Result";
DROP TABLE "Result";
ALTER TABLE "new_Result" RENAME TO "Result";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
