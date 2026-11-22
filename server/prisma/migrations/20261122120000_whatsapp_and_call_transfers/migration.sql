-- CreateTable
CREATE TABLE "whatsapp_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "waba_id" TEXT NOT NULL,
    "display_phone_number" TEXT,
    "verified_name" TEXT,
    "access_token" TEXT NOT NULL,
    "app_secret" TEXT NOT NULL,
    "verify_token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "last_error" TEXT,
    "templates" TEXT NOT NULL DEFAULT '[]',
    "templates_synced_at" TIMESTAMP(3),
    "webhook_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "call_id" TEXT,
    "agent_id" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "phone_number" TEXT NOT NULL,
    "template_name" TEXT,
    "language" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "meta_message_id" TEXT,
    "idempotency_key" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'opted_in',
    "source" TEXT NOT NULL DEFAULT 'call_verbal',
    "call_id" TEXT,
    "evidence" TEXT,
    "opted_in_at" TIMESTAMP(3),
    "opted_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_transfers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "from_agent_id" TEXT,
    "to_agent_id" TEXT,
    "destination_label" TEXT,
    "destination_number" TEXT,
    "reason" TEXT,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "dial_status" TEXT,
    "error_message" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_accounts_user_id_key" ON "whatsapp_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_accounts_phone_number_id_key" ON "whatsapp_accounts"("phone_number_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_meta_message_id_key" ON "whatsapp_messages"("meta_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_idempotency_key_key" ON "whatsapp_messages"("idempotency_key");

-- CreateIndex
CREATE INDEX "whatsapp_messages_user_id_created_at_idx" ON "whatsapp_messages"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_messages_call_id_idx" ON "whatsapp_messages"("call_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_user_id_phone_number_idx" ON "whatsapp_messages"("user_id", "phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_consents_user_id_phone_number_key" ON "whatsapp_consents"("user_id", "phone_number");

-- CreateIndex
CREATE INDEX "call_transfers_call_id_idx" ON "call_transfers"("call_id");

-- CreateIndex
CREATE INDEX "call_transfers_user_id_created_at_idx" ON "call_transfers"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_consents" ADD CONSTRAINT "whatsapp_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_transfers" ADD CONSTRAINT "call_transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_transfers" ADD CONSTRAINT "call_transfers_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

