-- CreateEnum
CREATE TYPE "BlocklistIdentifierType" AS ENUM ('EMAIL', 'PHONE', 'NAME');

-- CreateTable
CREATE TABLE "model_blocklist" (
    "id" TEXT NOT NULL,
    "modelProfileId" TEXT NOT NULL,
    "identifierType" "BlocklistIdentifierType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_blocklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "model_blocklist_modelProfileId_idx" ON "model_blocklist"("modelProfileId");

-- CreateIndex — prevent duplicate entries per model
CREATE UNIQUE INDEX "model_blocklist_modelProfileId_identifierType_identifier_key"
ON "model_blocklist"("modelProfileId", "identifierType", "identifier");

-- AddForeignKey
ALTER TABLE "model_blocklist" ADD CONSTRAINT "model_blocklist_modelProfileId_fkey"
FOREIGN KEY ("modelProfileId") REFERENCES "model_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;