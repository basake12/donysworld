import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MEET_LIMITS } from "@/lib/coins";
import { MeetType } from "@prisma/client";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function handleCharges(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "MODEL")
      return errorResponse("Only models can set charges", 403);

    const { charges } = await req.json();

    if (!charges) return errorResponse("Charges are required");

    const modelProfile = await prisma.modelProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!modelProfile) return errorResponse("Model profile not found");

    const types = ["SHORT", "OVERNIGHT", "WEEKEND"] as const;

    for (const type of types) {
      const min = charges[`${type}_min`];
      const max = charges[`${type}_max`];
      const limit = MEET_LIMITS[type];

      if (typeof min !== "number" || typeof max !== "number") {
        return errorResponse(`Invalid values for ${type}`);
      }

      if (min >= max) {
        return errorResponse(`${type}: minimum must be less than maximum`);
      }

      if (min < limit.min || max > limit.max) {
        return errorResponse(
          `${type}: values must be between ${limit.min} and ${limit.max}`
        );
      }
    }

    // Upsert all three charge types
    await prisma.$transaction(
      types.map((type) =>
        prisma.modelCharge.upsert({
          where: {
            modelProfileId_meetType: {
              modelProfileId: modelProfile.id,
              meetType: type as MeetType,
            },
          },
          update: {
            minCoins: charges[`${type}_min`],
            maxCoins: charges[`${type}_max`],
          },
          create: {
            modelProfileId: modelProfile.id,
            meetType: type as MeetType,
            minCoins: charges[`${type}_min`],
            maxCoins: charges[`${type}_max`],
          },
        })
      )
    );

    return NextResponse.json({ message: "Charges saved successfully" });
  } catch (err: any) {
    console.error("[MODEL CHARGES ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Support both POST (create) and PATCH (update)
export const POST = handleCharges;
export const PATCH = handleCharges;