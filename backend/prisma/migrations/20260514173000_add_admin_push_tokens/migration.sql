CREATE TABLE "AdminPushToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "deviceName" TEXT,
    "appVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminPushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminPushToken_token_key" ON "AdminPushToken"("token");
CREATE INDEX "AdminPushToken_userId_idx" ON "AdminPushToken"("userId");
CREATE INDEX "AdminPushToken_isActive_idx" ON "AdminPushToken"("isActive");

ALTER TABLE "AdminPushToken" ADD CONSTRAINT "AdminPushToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
