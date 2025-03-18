-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectAccess" (
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "accessLevel" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "projectId"),
    CONSTRAINT "ProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Volume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "creatorId" INTEGER,
    "rawDataId" INTEGER,
    CONSTRAINT "Volume_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Volume_rawDataId_fkey" FOREIGN KEY ("rawDataId") REFERENCES "RawVolumeData" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawVolumeData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT,
    "creatorId" INTEGER,
    "rawFilePath" TEXT,
    "settings" TEXT,
    "mrcFilePath" TEXT,
    CONSTRAINT "RawVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SparseLabelVolumeData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT,
    "creatorId" INTEGER,
    "rawFilePath" TEXT,
    "settings" TEXT,
    CONSTRAINT "SparseLabelVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PseudoLabelVolumeData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT,
    "creatorId" INTEGER,
    "rawFilePath" TEXT,
    "settings" TEXT,
    "originalLabelId" INTEGER,
    CONSTRAINT "PseudoLabelVolumeData_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PseudoLabelVolumeData_originalLabelId_fkey" FOREIGN KEY ("originalLabelId") REFERENCES "SparseLabelVolumeData" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Model" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "creatorId" INTEGER,
    CONSTRAINT "Model_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Checkpoint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filePath" TEXT,
    "folderPath" TEXT,
    "creatorId" INTEGER,
    CONSTRAINT "Checkpoint_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Result" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "folderPath" TEXT,
    "rawVolumeChannel" INTEGER,
    "logFile" TEXT,
    "creatorId" INTEGER,
    "checkpointId" INTEGER NOT NULL,
    "volumeDataId" INTEGER NOT NULL,
    CONSTRAINT "Result_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Result_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Result_volumeDataId_fkey" FOREIGN KEY ("volumeDataId") REFERENCES "RawVolumeData" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResultFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "rawFileName" TEXT NOT NULL,
    "settingsFileName" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "resultId" INTEGER NOT NULL,
    CONSTRAINT "ResultFile_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskHistory" (
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
    CONSTRAINT "TaskHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaskHistory_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskHistory_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskHistory_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ProjectToVolume" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_ProjectToVolume_A_fkey" FOREIGN KEY ("A") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ProjectToVolume_B_fkey" FOREIGN KEY ("B") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_SparseLabelVolumeDataToVolume" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_SparseLabelVolumeDataToVolume_A_fkey" FOREIGN KEY ("A") REFERENCES "SparseLabelVolumeData" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_SparseLabelVolumeDataToVolume_B_fkey" FOREIGN KEY ("B") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_PseudoLabelVolumeDataToVolume" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_PseudoLabelVolumeDataToVolume_A_fkey" FOREIGN KEY ("A") REFERENCES "PseudoLabelVolumeData" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_PseudoLabelVolumeDataToVolume_B_fkey" FOREIGN KEY ("B") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ModelToProject" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_ModelToProject_A_fkey" FOREIGN KEY ("A") REFERENCES "Model" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ModelToProject_B_fkey" FOREIGN KEY ("B") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_CheckpointToModel" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_CheckpointToModel_A_fkey" FOREIGN KEY ("A") REFERENCES "Checkpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CheckpointToModel_B_fkey" FOREIGN KEY ("B") REFERENCES "Model" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_CheckpointToPseudoLabelVolumeData" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_CheckpointToPseudoLabelVolumeData_A_fkey" FOREIGN KEY ("A") REFERENCES "Checkpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CheckpointToPseudoLabelVolumeData_B_fkey" FOREIGN KEY ("B") REFERENCES "PseudoLabelVolumeData" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ResultToVolume" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_ResultToVolume_A_fkey" FOREIGN KEY ("A") REFERENCES "Result" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ResultToVolume_B_fkey" FOREIGN KEY ("B") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectToVolume_AB_unique" ON "_ProjectToVolume"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectToVolume_B_index" ON "_ProjectToVolume"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_SparseLabelVolumeDataToVolume_AB_unique" ON "_SparseLabelVolumeDataToVolume"("A", "B");

-- CreateIndex
CREATE INDEX "_SparseLabelVolumeDataToVolume_B_index" ON "_SparseLabelVolumeDataToVolume"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PseudoLabelVolumeDataToVolume_AB_unique" ON "_PseudoLabelVolumeDataToVolume"("A", "B");

-- CreateIndex
CREATE INDEX "_PseudoLabelVolumeDataToVolume_B_index" ON "_PseudoLabelVolumeDataToVolume"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ModelToProject_AB_unique" ON "_ModelToProject"("A", "B");

-- CreateIndex
CREATE INDEX "_ModelToProject_B_index" ON "_ModelToProject"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CheckpointToModel_AB_unique" ON "_CheckpointToModel"("A", "B");

-- CreateIndex
CREATE INDEX "_CheckpointToModel_B_index" ON "_CheckpointToModel"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CheckpointToPseudoLabelVolumeData_AB_unique" ON "_CheckpointToPseudoLabelVolumeData"("A", "B");

-- CreateIndex
CREATE INDEX "_CheckpointToPseudoLabelVolumeData_B_index" ON "_CheckpointToPseudoLabelVolumeData"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ResultToVolume_AB_unique" ON "_ResultToVolume"("A", "B");

-- CreateIndex
CREATE INDEX "_ResultToVolume_B_index" ON "_ResultToVolume"("B");
