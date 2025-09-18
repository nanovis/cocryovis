/*
  Warnings:

  - You are about to drop the column `path` on the `PseudoLabelVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `rawFilePath` on the `PseudoLabelVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `mrcFilePath` on the `RawVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `path` on the `RawVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `rawFilePath` on the `RawVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `path` on the `SparseLabelVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `rawFilePath` on the `SparseLabelVolumeData` table. All the data in the column will be lost.
  - Added the required column `dataFileId` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dataFileId` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dataFileId` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "RawVolumeDataFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT,
    "rawFilePath" TEXT,
    "mrcFilePath" TEXT
);

-- CreateTable
CREATE TABLE "SparseVolumeDataFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT,
    "rawFilePath" TEXT
);

-- CreateTable
CREATE TABLE "PseudoVolumeDataFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT,
    "rawFilePath" TEXT
);

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
    "dataFileId" INTEGER NOT NULL,
    CONSTRAINT "PseudoLabelVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PseudoLabelVolumeData_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PseudoLabelVolumeData_originalLabelId_fkey" FOREIGN KEY ("originalLabelId") REFERENCES "SparseLabelVolumeData" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PseudoLabelVolumeData_dataFileId_fkey" FOREIGN KEY ("dataFileId") REFERENCES "PseudoVolumeDataFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PseudoLabelVolumeData" ("addValue", "bytesPerVoxel", "creatorId", "id", "isLittleEndian", "isSigned", "originalLabelId", "ratioX", "ratioY", "ratioZ", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId") SELECT "addValue", "bytesPerVoxel", "creatorId", "id", "isLittleEndian", "isSigned", "originalLabelId", "ratioX", "ratioY", "ratioZ", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId" FROM "PseudoLabelVolumeData";
DROP TABLE "PseudoLabelVolumeData";
ALTER TABLE "new_PseudoLabelVolumeData" RENAME TO "PseudoLabelVolumeData";
CREATE TABLE "new_RawVolumeData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "creatorId" INTEGER,
    "name" TEXT NOT NULL,
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
    "dataFileId" INTEGER NOT NULL,
    CONSTRAINT "RawVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RawVolumeData_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RawVolumeData_dataFileId_fkey" FOREIGN KEY ("dataFileId") REFERENCES "RawVolumeDataFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RawVolumeData" ("addValue", "bytesPerVoxel", "creatorId", "id", "isLittleEndian", "isSigned", "ratioX", "ratioY", "ratioZ", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId") SELECT "addValue", "bytesPerVoxel", "creatorId", "id", "isLittleEndian", "isSigned", "ratioX", "ratioY", "ratioZ", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId" FROM "RawVolumeData";
DROP TABLE "RawVolumeData";
ALTER TABLE "new_RawVolumeData" RENAME TO "RawVolumeData";
CREATE UNIQUE INDEX "RawVolumeData_volumeId_key" ON "RawVolumeData"("volumeId");
CREATE TABLE "new_SparseLabelVolumeData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "creatorId" INTEGER,
    "name" TEXT NOT NULL,
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
    "dataFileId" INTEGER NOT NULL,
    CONSTRAINT "SparseLabelVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SparseLabelVolumeData_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SparseLabelVolumeData_dataFileId_fkey" FOREIGN KEY ("dataFileId") REFERENCES "SparseVolumeDataFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SparseLabelVolumeData" ("addValue", "bytesPerVoxel", "color", "creatorId", "id", "isLittleEndian", "isSigned", "ratioX", "ratioY", "ratioZ", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId") SELECT "addValue", "bytesPerVoxel", "color", "creatorId", "id", "isLittleEndian", "isSigned", "ratioX", "ratioY", "ratioZ", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId" FROM "SparseLabelVolumeData";
DROP TABLE "SparseLabelVolumeData";
ALTER TABLE "new_SparseLabelVolumeData" RENAME TO "SparseLabelVolumeData";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
