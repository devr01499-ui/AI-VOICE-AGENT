-- AlterTable
ALTER TABLE "phone_numbers" ADD COLUMN "plivo_number_id" TEXT,
ADD COLUMN "plivo_sub_auth_id" TEXT;

-- CreateTable
CREATE TABLE "plivo_sub_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "auth_id" TEXT NOT NULL,
    "auth_token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plivo_sub_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plivo_sub_accounts_user_id_key" ON "plivo_sub_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plivo_sub_accounts_auth_id_key" ON "plivo_sub_accounts"("auth_id");

-- CreateIndex
CREATE INDEX "plivo_sub_accounts_auth_id_idx" ON "plivo_sub_accounts"("auth_id");

-- AddForeignKey
ALTER TABLE "plivo_sub_accounts" ADD CONSTRAINT "plivo_sub_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
