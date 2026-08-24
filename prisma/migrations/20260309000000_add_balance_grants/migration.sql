-- CreateTable
CREATE TABLE "balance_grants" (
    "id" SERIAL NOT NULL,
    "issuer_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "balance_grants_issuer_id_idx" ON "balance_grants"("issuer_id");

-- CreateIndex
CREATE INDEX "balance_grants_recipient_id_idx" ON "balance_grants"("recipient_id");

-- AddConstraint
ALTER TABLE "balance_grants"
  ADD CONSTRAINT "balance_grants_amount_check" CHECK ("amount" > 0);

-- AddForeignKey
ALTER TABLE "balance_grants"
  ADD CONSTRAINT "balance_grants_issuer_id_fkey"
  FOREIGN KEY ("issuer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_grants"
  ADD CONSTRAINT "balance_grants_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
