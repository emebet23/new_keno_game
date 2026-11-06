/*
  Warnings:

  - Added the required column `updatedAt` to the `Ticket` table without a default value. This is not possible if the table is not empty.
  - Made the column `matches` on table `Ticket` required. This step will fail if there are existing NULL values in that column.
  - Made the column `multiplier` on table `Ticket` required. This step will fail if there are existing NULL values in that column.
  - Made the column `payout` on table `Ticket` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_gameId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_userId_fkey";

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "status" "TicketStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "matches" SET NOT NULL,
ALTER COLUMN "matches" SET DEFAULT 0,
ALTER COLUMN "multiplier" SET NOT NULL,
ALTER COLUMN "multiplier" SET DEFAULT 0,
ALTER COLUMN "multiplier" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "payout" SET NOT NULL,
ALTER COLUMN "payout" SET DEFAULT 0,
ALTER COLUMN "payout" SET DATA TYPE DECIMAL(65,30);

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "KenoGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
