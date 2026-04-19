import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fix() {
  const r1 = await prisma.modelProfile.updateMany({
    where: { originalPictureUrl: { not: null } },
    data: { isFaceBlurred: true },
  });

  console.log("Profiles updated:", r1.count);

  try {
    const r2 = await (prisma as any).modelGallery.updateMany({
      where: { originalImageUrl: { not: null } },
      data: { isFaceBlurred: true },
    });
    console.log("Gallery updated:", r2.count);
  } catch {
    console.log("Gallery has no isFaceBlurred field — skipping.");
  }

  await prisma.$disconnect();
  console.log("Done.");
}

fix().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});