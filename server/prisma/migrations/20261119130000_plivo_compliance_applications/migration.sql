-- Plivo India business KYC (compliance applications per customer subaccount). Additive.
-- Rollback: DROP TABLE "plivo_compliance_applications";
-- CreateTable
CREATE TABLE "plivo_compliance_applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "compliance_id" TEXT NOT NULL,
    "subaccount_auth_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plivo_compliance_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plivo_compliance_applications_user_id_key" ON "plivo_compliance_applications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plivo_compliance_applications_compliance_id_key" ON "plivo_compliance_applications"("compliance_id");

-- CreateIndex
CREATE INDEX "plivo_compliance_applications_status_idx" ON "plivo_compliance_applications"("status");

-- AddForeignKey
ALTER TABLE "plivo_compliance_applications" ADD CONSTRAINT "plivo_compliance_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

