/*
  Warnings:

  - You are about to drop the column `settings` on the `PseudoLabelVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `settings` on the `RawVolumeData` table. All the data in the column will be lost.
  - You are about to drop the column `settings` on the `SparseLabelVolumeData` table. All the data in the column will be lost.
  - Added the required column `addValue` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bytesPerVoxel` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isLittleEndian` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isSigned` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ratioX` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ratioY` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ratioZ` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeX` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeY` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeZ` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `skipBytes` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usedBits` to the `PseudoLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addValue` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bytesPerVoxel` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isLittleEndian` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isSigned` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ratioX` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ratioY` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ratioZ` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeX` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeY` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeZ` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `skipBytes` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usedBits` to the `RawVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addValue` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bytesPerVoxel` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isLittleEndian` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isSigned` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ratioX` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ratioY` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ratioZ` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeX` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeY` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeZ` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `skipBytes` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usedBits` to the `SparseLabelVolumeData` table without a default value. This is not possible if the table is not empty.

*/
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
    "originalLabelId" INTEGER,
    CONSTRAINT "PseudoLabelVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PseudoLabelVolumeData_originalLabelId_fkey" FOREIGN KEY ("originalLabelId") REFERENCES "SparseLabelVolumeData" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PseudoLabelVolumeData" ("creatorId", "id", "originalLabelId", "path", "rawFilePath") SELECT "creatorId", "id", "originalLabelId", "path", "rawFilePath" FROM "PseudoLabelVolumeData";
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
    CONSTRAINT "RawVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RawVolumeData" ("creatorId", "id", "mrcFilePath", "path", "rawFilePath") SELECT "creatorId", "id", "mrcFilePath", "path", "rawFilePath" FROM "RawVolumeData";
DROP TABLE "RawVolumeData";
ALTER TABLE "new_RawVolumeData" RENAME TO "RawVolumeData";
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
    "color" TEXT,
    CONSTRAINT "SparseLabelVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SparseLabelVolumeData" ("color", "creatorId", "id", "path", "rawFilePath") SELECT "color", "creatorId", "id", "path", "rawFilePath" FROM "SparseLabelVolumeData";
DROP TABLE "SparseLabelVolumeData";
ALTER TABLE "new_SparseLabelVolumeData" RENAME TO "SparseLabelVolumeData";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
