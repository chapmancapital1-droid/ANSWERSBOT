-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'TRIAL_WILL_END';

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_businessId_createdAt_idx" ON "reports"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
