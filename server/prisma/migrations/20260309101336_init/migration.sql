/*
  Warnings:

  - You are about to drop the column `ratioX` on the `PseudoLabelVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `ratioY` on the `PseudoLabelVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `ratioZ` on the `PseudoLabelVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `ratioX` on the `RawVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `ratioY` on the `RawVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `ratioZ` on the `RawVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `ratioX` on the `ResultVolume` table. All the data in the column will be lost.
  - You are about to drop the column `ratioY` on the `ResultVolume` table. All the data in the column will be lost.
  - You are about to drop the column `ratioZ` on the `ResultVolume` table. All the data in the column will be lost.
  - You are about to drop the column `ratioX` on the `SparseLabelVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `ratioY` on the `SparseLabelVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `ratioZ` on the `SparseLabelVolumeData` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PseudoLabelVolumeData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "creatorId" INTEGER,
    "name" TEXT NOT NULL,
    "sizeX" INTEGER NOT NULL,
    "sizeY" INTEGER NOT NULL,
    "sizeZ" INTEGER NOT NULL,
    "skipBytes" INTEGER NOT NULL,
    "isLittleEndian" BOOLEAN NOT NULL,
    "isSigned" BOOLEAN NOT NULL,
    "addValue" INTEGER NOT NULL,
    "bytesPerVoxel" INTEGER NOT NULL,
    "usedBits" INTEGER NOT NULL,
    "volumeId" INTEGER NOT NULL,
    "originalLabelId" INTEGER,
    "dataFileId" INTEGER NOT NULL,
    CONSTRAINT "PseudoLabelVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PseudoLabelVolumeData_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PseudoLabelVolumeData_originalLabelId_fkey" FOREIGN KEY ("originalLabelId") REFERENCES "SparseLabelVolumeData" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PseudoLabelVolumeData_dataFileId_fkey" FOREIGN KEY ("dataFileId") REFERENCES "PseudoVolumeDataFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PseudoLabelVolumeData" ("addValue", "bytesPerVoxel", "creatorId", "dataFileId", "id", "isLittleEndian", "isSigned", "name", "originalLabelId", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId") SELECT "addValue", "bytesPerVoxel", "creatorId", "dataFileId", "id", "isLittleEndian", "isSigned", "name", "originalLabelId", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId" FROM "PseudoLabelVolumeData";
DROP TABLE "PseudoLabelVolumeData";
ALTER TABLE "new_PseudoLabelVolumeData" RENAME TO "PseudoLabelVolumeData";
CREATE TABLE "new_RawVolumeData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "creatorId" INTEGER,
    "name" TEXT NOT NULL,
    "sizeX" INTEGER NOT NULL,
    "sizeY" INTEGER NOT NULL,
    "sizeZ" INTEGER NOT NULL,
    "skipBytes" INTEGER NOT NULL,
    "isLittleEndian" BOOLEAN NOT NULL,
    "isSigned" BOOLEAN NOT NULL,
    "addValue" INTEGER NOT NULL,
    "bytesPerVoxel" INTEGER NOT NULL,
    "usedBits" INTEGER NOT NULL,
    "volumeId" INTEGER NOT NULL,
    "dataFileId" INTEGER NOT NULL,
    CONSTRAINT "RawVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RawVolumeData_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RawVolumeData_dataFileId_fkey" FOREIGN KEY ("dataFileId") REFERENCES "RawVolumeDataFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RawVolumeData" ("addValue", "bytesPerVoxel", "creatorId", "dataFileId", "id", "isLittleEndian", "isSigned", "name", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId") SELECT "addValue", "bytesPerVoxel", "creatorId", "dataFileId", "id", "isLittleEndian", "isSigned", "name", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId" FROM "RawVolumeData";
DROP TABLE "RawVolumeData";
ALTER TABLE "new_RawVolumeData" RENAME TO "RawVolumeData";
CREATE UNIQUE INDEX "RawVolumeData_volumeId_key" ON "RawVolumeData"("volumeId");
CREATE TABLE "new_ResultVolume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "resultId" INTEGER NOT NULL,
    "dataFileId" INTEGER NOT NULL,
    "sizeX" INTEGER NOT NULL,
    "sizeY" INTEGER NOT NULL,
    "sizeZ" INTEGER NOT NULL,
    "skipBytes" INTEGER NOT NULL,
    "isLittleEndian" BOOLEAN NOT NULL,
    "isSigned" BOOLEAN NOT NULL,
    "addValue" INTEGER NOT NULL,
    "bytesPerVoxel" INTEGER NOT NULL,
    "usedBits" INTEGER NOT NULL,
    CONSTRAINT "ResultVolume_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResultVolume_dataFileId_fkey" FOREIGN KEY ("dataFileId") REFERENCES "ResultDataFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ResultVolume" ("addValue", "bytesPerVoxel", "dataFileId", "id", "index", "isLittleEndian", "isSigned", "name", "resultId", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits") SELECT "addValue", "bytesPerVoxel", "dataFileId", "id", "index", "isLittleEndian", "isSigned", "name", "resultId", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits" FROM "ResultVolume";
DROP TABLE "ResultVolume";
ALTER TABLE "new_ResultVolume" RENAME TO "ResultVolume";
CREATE TABLE "new_SparseLabelVolumeData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "creatorId" INTEGER,
    "name" TEXT NOT NULL,
    "sizeX" INTEGER NOT NULL,
    "sizeY" INTEGER NOT NULL,
    "sizeZ" INTEGER NOT NULL,
    "skipBytes" INTEGER NOT NULL,
    "isLittleEndian" BOOLEAN NOT NULL,
    "isSigned" BOOLEAN NOT NULL,
    "addValue" INTEGER NOT NULL,
    "bytesPerVoxel" INTEGER NOT NULL,
    "usedBits" INTEGER NOT NULL,
    "volumeId" INTEGER NOT NULL,
    "color" TEXT,
    "dataFileId" INTEGER NOT NULL,
    CONSTRAINT "SparseLabelVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SparseLabelVolumeData_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SparseLabelVolumeData_dataFileId_fkey" FOREIGN KEY ("dataFileId") REFERENCES "SparseVolumeDataFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SparseLabelVolumeData" ("addValue", "bytesPerVoxel", "color", "creatorId", "dataFileId", "id", "isLittleEndian", "isSigned", "name", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId") SELECT "addValue", "bytesPerVoxel", "color", "creatorId", "dataFileId", "id", "isLittleEndian", "isSigned", "name", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId" FROM "SparseLabelVolumeData";
DROP TABLE "SparseLabelVolumeData";
ALTER TABLE "new_SparseLabelVolumeData" RENAME TO "SparseLabelVolumeData";
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
INSERT INTO "new_Volume" ("creatorId", "description", "id", "name", "projectId") SELECT "creatorId", "description", "id", "name", "projectId" FROM "Volume";
DROP TABLE "Volume";
ALTER TABLE "new_Volume" RENAME TO "Volume";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
