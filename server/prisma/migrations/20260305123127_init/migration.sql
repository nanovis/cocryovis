/*
  Warnings:

  - You are about to drop the `ResultFile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `folderPath` on the `Result` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ResultFile";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ResultVolume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "resultId" INTEGER NOT NULL,
    "dataFileId" INTEGER NOT NULL,
    "sizeX" INTEGER NOT NULL,
    "sizeY" INTEGER NOT NULL,
    "sizeZ" INTEGER NOT NULL,
    "ratioX" REAL NOT NULL,
    "ratioY" REAL NOT NULL,
    "ratioZ" REAL NOT NULL,
    "skipBytes" INTEGER NOT NULL,
    "isLittleEndian" BOOLEAN NOT NULL,
    "isSigned" BOOLEAN NOT NULL,
    "addValue" INTEGER NOT NULL,
    "bytesPerVoxel" INTEGER NOT NULL,
    "usedBits" INTEGER NOT NULL,
    CONSTRAINT "ResultVolume_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResultVolume_dataFileId_fkey" FOREIGN KEY ("dataFileId") REFERENCES "ResultDataFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResultDataFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT,
    "rawFilePath" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Result" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rawVolumeChannel" INTEGER,
    "logFile" TEXT,
    "creatorId" INTEGER,
    "checkpointId" INTEGER NOT NULL,
    "volumeId" INTEGER NOT NULL,
    CONSTRAINT "Result_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Result_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Result_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Result" ("checkpointId", "creatorId", "id", "logFile", "rawVolumeChannel", "volumeId") SELECT "checkpointId", "creatorId", "id", "logFile", "rawVolumeChannel", "volumeId" FROM "Result";
DROP TABLE "Result";
ALTER TABLE "new_Result" RENAME TO "Result";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
