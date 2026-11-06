/*
  Warnings:

  - You are about to alter the column `multiplier` on the `Ticket` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(18,2)`.
  - You are about to alter the column `payout` on the `Ticket` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(18,2)`.
  - A unique constraint covering the columns `[referenceId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('CLASSIC', 'INSTANT');

-- CreateEnum
CREATE TYPE "WalletSource" AS ENUM ('PLAY', 'MAIN');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'REJECTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER';
ALTER TYPE "TransactionType" ADD VALUE 'REFERRAL';

-- AlterTable
ALTER TABLE "KenoGame" ADD COLUMN     "mode" "GameMode" NOT NULL DEFAULT 'CLASSIC';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "mode" "GameMode" NOT NULL DEFAULT 'CLASSIC',
ALTER COLUMN "multiplier" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "payout" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "description" TEXT,
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "walletId" TEXT,
ADD COLUMN     "walletSource" "WalletSource";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "language" TEXT DEFAULT 'am',
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "referredBy" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER',
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "DepositRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "referenceId" TEXT NOT NULL,
    "paymentMethod" TEXT DEFAULT 'telebirr',
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedData" JSONB,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "numberPoolSize" INTEGER NOT NULL DEFAULT 80,
    "drawCount" INTEGER NOT NULL DEFAULT 20,
    "minPick" INTEGER NOT NULL DEFAULT 1,
    "maxPick" INTEGER NOT NULL DEFAULT 10,
    "minBet" DECIMAL(18,2) NOT NULL DEFAULT 1,
    "maxBet" DECIMAL(18,2) NOT NULL DEFAULT 10000,
    "payoutTable" JSONB NOT NULL,
    "rtpPercentage" DECIMAL(5,2) NOT NULL DEFAULT 95.0,
    "houseEdge" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "drawIntervalSec" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepositRequest_referenceId_key" ON "DepositRequest"("referenceId");

-- CreateIndex
CREATE INDEX "DepositRequest_userId_idx" ON "DepositRequest"("userId");

-- CreateIndex
CREATE INDEX "DepositRequest_status_idx" ON "DepositRequest"("status");

-- CreateIndex
CREATE INDEX "DepositRequest_referenceId_idx" ON "DepositRequest"("referenceId");

-- CreateIndex
CREATE INDEX "KenoGame_roundNumber_idx" ON "KenoGame"("roundNumber");

-- CreateIndex
CREATE INDEX "KenoGame_status_idx" ON "KenoGame"("status");

-- CreateIndex
CREATE INDEX "KenoGame_mode_idx" ON "KenoGame"("mode");

-- CreateIndex
CREATE INDEX "Ticket_userId_idx" ON "Ticket"("userId");

-- CreateIndex
CREATE INDEX "Ticket_gameId_idx" ON "Ticket"("gameId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_referenceId_key" ON "Transaction"("referenceId");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_referenceId_idx" ON "Transaction"("referenceId");

-- CreateIndex
CREATE INDEX "User_telegramId_idx" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositRequest" ADD CONSTRAINT "DepositRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
