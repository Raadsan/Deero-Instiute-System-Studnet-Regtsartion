CREATE TABLE "SmsMessage" (
    "id" TEXT NOT NULL,
    "to" TEXT,
    "body" TEXT NOT NULL,
    "meta" JSONB NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "error" TEXT,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SmsMessage_createdAt_idx" ON "SmsMessage"("createdAt");
CREATE INDEX "SmsMessage_status_idx" ON "SmsMessage"("status");
