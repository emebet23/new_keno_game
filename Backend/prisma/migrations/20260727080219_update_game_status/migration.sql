/*
  Warnings:

  - The values [PENDING] on the enum `GameStatus` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `updatedAt` to the `KenoGame` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "GameStatus_new" AS ENUM ('WAITING', 'DRAWING', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."KenoGame" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "KenoGame" ALTER COLUMN "status" TYPE "GameStatus_new" USING ("status"::text::"GameStatus_new");
ALTER TYPE "GameStatus" RENAME TO "GameStatus_old";
ALTER TYPE "GameStatus_new" RENAME TO "GameStatus";
DROP TYPE "public"."GameStatus_old";
ALTER TABLE "KenoGame" ALTER COLUMN "status" SET DEFAULT 'WAITING';
COMMIT;

-- AlterTable
ALTER TABLE "KenoGame" ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'WAITING';
