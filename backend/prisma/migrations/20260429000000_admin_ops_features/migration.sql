ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isDraft" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "AdminNote" (
  "id" SERIAL PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "authorId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AdminNote_entityType_entityId_idx" ON "AdminNote"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AdminNote_createdAt_idx" ON "AdminNote"("createdAt");
