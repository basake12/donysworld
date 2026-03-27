import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BodyType, Complexion } from "@prisma/client";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "MODEL")
      return errorResponse("Only models can update their profile", 403);

    const body = await req.json();
    const {
      age,
      height,
      city,
      state,
      bodyType,
      complexion,
      about,
      allowFaceReveal,
    } = body;

    if (!age || !height || !city || !state || !bodyType || !complexion || !about) {
      return errorResponse("All fields are required");
    }

    if (age < 18 || age > 60) {
      return errorResponse("Age must be between 18 and 60");
    }

    const validBodyTypes = ["SLIM", "AVERAGE", "ATHLETIC", "CURVY", "PLUS_SIZE"];
    if (!validBodyTypes.includes(bodyType)) {
      return errorResponse("Invalid body type");
    }

    const validComplexions = ["FAIR", "LIGHT", "MEDIUM", "OLIVE", "TAN", "DARK"];
    if (!validComplexions.includes(complexion)) {
      return errorResponse("Invalid complexion");
    }

    await prisma.modelProfile.update({
      where: { userId: session.user.id },
      data: {
        age: parseInt(age),
        height,
        city,
        state,
        bodyType: bodyType as BodyType,
        complexion: complexion as Complexion,
        about,
        allowFaceReveal: Boolean(allowFaceReveal),
      },
    });

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (err: any) {
    console.error("[MODEL PROFILE PATCH ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}