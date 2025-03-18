-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProjectAccess" (
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "accessLevel" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "projectId"),
    CONSTRAINT "ProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProjectAccess" ("accessLevel", "projectId", "userId") SELECT "accessLevel", "projectId", "userId" FROM "ProjectAccess";
DROP TABLE "ProjectAccess";
ALTER TABLE "new_ProjectAccess" RENAME TO "ProjectAccess";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
