import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MEET_LIMITS } from "@/lib/coins";
import { MeetType } from "@prisma/client";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const VALID_TYPES = ["SHORT", "OVERNIGHT", "WEEKEND"] as const;

async function handleCharges(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "MODEL")
      return errorResponse("Only models can set charges", 403);

    const { charges } = await req.json();

    // Accept array format: [{ meetType, minCoins, maxCoins }]
    if (!Array.isArray(charges) || charges.length === 0)
      return errorResponse("Charges must be a non-empty array");

    const modelProfile = await prisma.modelProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!modelProfile) return errorResponse("Model profile not found");

    for (const charge of charges) {
      const { meetType, minCoins, maxCoins } = charge;

      if (!VALID_TYPES.includes(meetType))
        return errorResponse(`Invalid meetType: ${meetType}`);

      if (typeof minCoins !== "number" || typeof maxCoins !== "number")
        return errorResponse(`Invalid values for ${meetType}`);

      const limit = MEET_LIMITS[meetType as typeof VALID_TYPES[number]];

      if (minCoins >= maxCoins)
        return errorResponse(`${meetType}: minimum must be less than maximum`);

      if (minCoins < limit.min || maxCoins > limit.max)
        return errorResponse(`${meetType}: values must be between ${limit.min} and ${limit.max}`);
    }

    await prisma.$transaction(
      charges.map(({ meetType, minCoins, maxCoins }: { meetType: MeetType; minCoins: number; maxCoins: number }) =>
        prisma.modelCharge.upsert({
          where: { modelProfileId_meetType: { modelProfileId: modelProfile.id, meetType } },
          update: { minCoins, maxCoins },
          create: { modelProfileId: modelProfile.id, meetType, minCoins, maxCoins },
        })
      )
    );

    return NextResponse.json({ message: "Charges saved successfully" });
  } catch (err: any) {
    console.error("[MODEL CHARGES ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = handleCharges;
export const PATCH = handleCharges;