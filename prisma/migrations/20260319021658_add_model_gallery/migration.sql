-- CreateTable
CREATE TABLE "model_gallery" (
    "id" TEXT NOT NULL,
    "modelProfileId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_gallery_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "model_gallery" ADD CONSTRAINT "model_gallery_modelProfileId_fkey" FOREIGN KEY ("modelProfileId") REFERENCES "model_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
