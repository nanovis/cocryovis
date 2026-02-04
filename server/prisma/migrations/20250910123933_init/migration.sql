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
    CONSTRAINT "Checkpoint_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Checkpoint" ("creatorId", "filePath", "folderPath", "id", "modelId") SELECT "creatorId", "filePath", "folderPath", "id", "modelId" FROM "Checkpoint";
DROP TABLE "Checkpoint";
ALTER TABLE "new_Checkpoint" RENAME TO "Checkpoint";
CREATE TABLE "new_Model" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "creatorId" INTEGER,
    "projectId" INTEGER NOT NULL,
    CONSTRAINT "Model_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Model_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Model" ("creatorId", "description", "id", "name", "projectId") SELECT "creatorId", "description", "id", "name", "projectId" FROM "Model";
DROP TABLE "Model";
ALTER TABLE "new_Model" RENAME TO "Model";
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
    CONSTRAINT "PseudoLabelVolumeData_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PseudoLabelVolumeData_originalLabelId_fkey" FOREIGN KEY ("originalLabelId") REFERENCES "SparseLabelVolumeData" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PseudoLabelVolumeData" ("addValue", "bytesPerVoxel", "creatorId", "id", "isLittleEndian", "isSigned", "originalLabelId", "path", "ratioX", "ratioY", "ratioZ", "rawFilePath", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId") SELECT "addValue", "bytesPerVoxel", "creatorId", "id", "isLittleEndian", "isSigned", "originalLabelId", "path", "ratioX", "ratioY", "ratioZ", "rawFilePath", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId" FROM "PseudoLabelVolumeData";
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
    CONSTRAINT "RawVolumeData_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RawVolumeData" ("addValue", "bytesPerVoxel", "creatorId", "id", "isLittleEndian", "isSigned", "mrcFilePath", "path", "ratioX", "ratioY", "ratioZ", "rawFilePath", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId") SELECT "addValue", "bytesPerVoxel", "creatorId", "id", "isLittleEndian", "isSigned", "mrcFilePath", "path", "ratioX", "ratioY", "ratioZ", "rawFilePath", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId" FROM "RawVolumeData";
DROP TABLE "RawVolumeData";
ALTER TABLE "new_RawVolumeData" RENAME TO "RawVolumeData";
CREATE UNIQUE INDEX "RawVolumeData_volumeId_key" ON "RawVolumeData"("volumeId");
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
    CONSTRAINT "Result_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Result" ("checkpointId", "creatorId", "folderPath", "id", "logFile", "rawVolumeChannel", "volumeDataId", "volumeId") SELECT "checkpointId", "creatorId", "folderPath", "id", "logFile", "rawVolumeChannel", "volumeDataId", "volumeId" FROM "Result";
DROP TABLE "Result";
ALTER TABLE "new_Result" RENAME TO "Result";
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
    CONSTRAINT "SparseLabelVolumeData_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SparseLabelVolumeData" ("addValue", "bytesPerVoxel", "color", "creatorId", "id", "isLittleEndian", "isSigned", "path", "ratioX", "ratioY", "ratioZ", "rawFilePath", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId") SELECT "addValue", "bytesPerVoxel", "color", "creatorId", "id", "isLittleEndian", "isSigned", "path", "ratioX", "ratioY", "ratioZ", "rawFilePath", "sizeX", "sizeY", "sizeZ", "skipBytes", "usedBits", "volumeId" FROM "SparseLabelVolumeData";
DROP TABLE "SparseLabelVolumeData";
ALTER TABLE "new_SparseLabelVolumeData" RENAME TO "SparseLabelVolumeData";
CREATE TABLE "new_TaskHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskType" INTEGER NOT NULL,
    "taskStatus" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "logFile" TEXT,
    "enqueuedTime" DATETIME NOT NULL,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "volumeId" INTEGER,
    "modelId" INTEGER,
    "checkpointId" INTEGER,
    CONSTRAINT "TaskHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskHistory_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskHistory_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskHistory_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TaskHistory" ("checkpointId", "endTime", "enqueuedTime", "id", "logFile", "modelId", "startTime", "taskStatus", "taskType", "userId", "volumeId") SELECT "checkpointId", "endTime", "enqueuedTime", "id", "logFile", "modelId", "startTime", "taskStatus", "taskType", "userId", "volumeId" FROM "TaskHistory";
DROP TABLE "TaskHistory";
ALTER TABLE "new_TaskHistory" RENAME TO "TaskHistory";
CREATE TABLE "new_Volume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
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
