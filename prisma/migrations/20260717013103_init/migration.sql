-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "twilioNumber" TEXT NOT NULL,
    "forwardingNumber" TEXT,
    "smsTemplate" TEXT NOT NULL DEFAULT 'Sorry we missed your call! We''ll text you back shortly.',
    "ownerNotifyNumber" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "dialTimeoutSeconds" INTEGER NOT NULL DEFAULT 20,
    "smsCooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "callSid" TEXT NOT NULL,
    "callerNumber" TEXT NOT NULL,
    "calledNumber" TEXT NOT NULL,
    "dialOutcome" TEXT,
    "textSent" BOOLEAN NOT NULL DEFAULT false,
    "textSentAt" TIMESTAMP(3),
    "smsSkipReason" TEXT,
    "ownerNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_twilioNumber_key" ON "Business"("twilioNumber");

-- CreateIndex
CREATE INDEX "Business_twilioNumber_idx" ON "Business"("twilioNumber");

-- CreateIndex
CREATE INDEX "Business_name_idx" ON "Business"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CallLog_callSid_key" ON "CallLog"("callSid");

-- CreateIndex
CREATE INDEX "CallLog_businessId_callerNumber_createdAt_idx" ON "CallLog"("businessId", "callerNumber", "createdAt");

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
