/*
  Warnings:

  - You are about to drop the `_PseudoLabelVolumeDataToVolume` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_SparseLabelVolumeDataToVolume` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `rawDataId` on the `Volume` table. All the data in the column will be lost.
  - Added the required column `volumeId` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `volumeId` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `volumeId` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "_PseudoLabelVolumeDataToVolume_B_index";

-- DropIndex
DROP INDEX "_PseudoLabelVolumeDataToVolume_AB_unique";

-- DropIndex
DROP INDEX "_SparseLabelVolumeDataToVolume_B_index";

-- DropIndex
DROP INDEX "_SparseLabelVolumeDataToVolume_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_PseudoLabelVolumeDataToVolume";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_SparseLabelVolumeDataToVolume";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PseudoLabelVolumeData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT,
    "creatorId" INTEGER,
    "rawFilePath" TEXT,
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
    "volumeId" INTEGER NOT NULL,
    "originalLabelId" INTEGER,
    CONSTRAINT "PseudoLabelVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PseudoLabelVolumeData_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PseudoLabelVolumeData_originalLabelId_fkey" FOREIGN KEY ("originalLabelId") REFERENCES "SparseLabelVolumeData" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PseudoLabelVolumeData" ("addValue", "bytesPerVoxel", "creatorId", "id", "isLittleEndian", "isSigned", "originalLabelId", "path", "ratioX", "ratioY", "ratioZ", "rawFilePath", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits") SELECT "addValue", "bytesPerVoxel", "creatorId", "id", "isLittleEndian", "isSigned", "originalLabelId", "path", "ratioX", "ratioY", "ratioZ", "rawFilePath", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits" FROM "PseudoLabelVolumeData";
DROP TABLE "PseudoLabelVolumeData";
ALTER TABLE "new_PseudoLabelVolumeData" RENAME TO "PseudoLabelVolumeData";
CREATE TABLE "new_RawVolumeData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT,
    "creatorId" INTEGER,
    "rawFilePath" TEXT,
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
    "mrcFilePath" TEXT,
    "volumeId" INTEGER NOT NULL,
    CONSTRAINT "RawVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RawVolumeData_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RawVolumeData" ("addValue", "bytesPerVoxel", "creatorId", "id", "isLittleEndian", "isSigned", "mrcFilePath", "path", "ratioX", "ratioY", "ratioZ", "rawFilePath", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits") SELECT "addValue", "bytesPerVoxel", "creatorId", "id", "isLittleEndian", "isSigned", "mrcFilePath", "path", "ratioX", "ratioY", "ratioZ", "rawFilePath", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits" FROM "RawVolumeData";
DROP TABLE "RawVolumeData";
ALTER TABLE "new_RawVolumeData" RENAME TO "RawVolumeData";
CREATE UNIQUE INDEX "RawVolumeData_volumeId_key" ON "RawVolumeData"("volumeId");
CREATE TABLE "new_SparseLabelVolumeData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT,
    "creatorId" INTEGER,
    "rawFilePath" TEXT,
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
    "volumeId" INTEGER NOT NULL,
    "color" TEXT,
    CONSTRAINT "SparseLabelVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SparseLabelVolumeData_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SparseLabelVolumeData" ("addValue", "bytesPerVoxel", "color", "creatorId", "id", "isLittleEndian", "isSigned", "path", "ratioX", "ratioY", "ratioZ", "rawFilePath", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits") SELECT "addValue", "bytesPerVoxel", "color", "creatorId", "id", "isLittleEndian", "isSigned", "path", "ratioX", "ratioY", "ratioZ", "rawFilePath", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits" FROM "SparseLabelVolumeData";
DROP TABLE "SparseLabelVolumeData";
ALTER TABLE "new_SparseLabelVolumeData" RENAME TO "SparseLabelVolumeData";
CREATE TABLE "new_Volume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "creatorId" INTEGER,
    "projectId" INTEGER NOT NULL,
    CONSTRAINT "Volume_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Volume_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Volume" ("creatorId", "description", "id", "name", "projectId") SELECT "creatorId", "description", "id", "name", "projectId" FROM "Volume";
DROP TABLE "Volume";
ALTER TABLE "new_Volume" RENAME TO "Volume";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
