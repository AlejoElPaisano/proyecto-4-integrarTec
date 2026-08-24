-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "service_id" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transactions_from_user_id_idx" ON "transactions"("from_user_id");

-- CreateIndex
CREATE INDEX "transactions_to_user_id_idx" ON "transactions"("to_user_id");

-- CreateIndex
CREATE INDEX "transactions_service_id_idx" ON "transactions"("service_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- AddConstraint
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_minutes_check" CHECK ("minutes" > 0);

-- AddForeignKey
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_from_user_id_fkey"
  FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_to_user_id_fkey"
  FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
