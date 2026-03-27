/*
  Warnings:

  - Added the required column `expiresAt` to the `face_reveals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable (step 1: add as nullable)
ALTER TABLE "face_reveals" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Backfill existing rows (step 2: set a value for existing rows)
UPDATE "face_reveals" SET "expiresAt" = NOW() + INTERVAL '30 days' WHERE "expiresAt" IS NULL;

-- Make it required (step 3: now safe to set NOT NULL)
ALTER TABLE "face_reveals" ALTER COLUMN "expiresAt" SET NOT NULL;