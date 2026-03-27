import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin, BUCKETS } from "@/lib/supabase";
import { nairaToCoins } from "@/lib/coins";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// POST — client submits a funding request with proof screenshot
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "CLIENT")
      return errorResponse("Only clients can submit funding requests", 403);

    const formData = await req.formData();
    const nairaAmountRaw = formData.get("nairaAmount") as string;
    const proofFile = formData.get("proof") as File | null;

    if (!nairaAmountRaw || !proofFile) {
      return errorResponse("Amount and payment proof are required");
    }

    const nairaAmount = parseInt(nairaAmountRaw);

    if (isNaN(nairaAmount) || nairaAmount < 1000) {
      return errorResponse("Minimum funding amount is ₦1,000");
    }

    if (nairaAmount > 1000000) {
      return errorResponse("Maximum single funding is ₦1,000,000");
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(proofFile.type)) {
      return errorResponse("Proof must be a JPG, PNG or WebP image");
    }

    if (proofFile.size > 5 * 1024 * 1024) {
      return errorResponse("Proof image must be under 5MB");
    }

    // Check for existing pending request
    const pendingExists = await prisma.fundingRequest.findFirst({
      where: { userId: session.user.id, status: "PENDING" },
    });

    if (pendingExists) {
      return errorResponse(
        "You already have a pending funding request. Wait for admin review before submitting another."
      );
    }

    // Upload proof to public bucket
    const timestamp = Date.now();
    const ext = proofFile.name.split(".").pop();
    const path = `funding-proofs/${session.user.id}_${timestamp}.${ext}`;

    const arrayBuffer = await proofFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKETS.PROFILE_PICTURES)
      .upload(path, buffer, {
        contentType: proofFile.type,
        upsert: false,
      });

    if (uploadError) {
      return errorResponse(`Proof upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKETS.PROFILE_PICTURES)
      .getPublicUrl(path);

    const coinsAmount = nairaToCoins(nairaAmount);

    // Create funding request
    const fundingRequest = await prisma.fundingRequest.create({
      data: {
        userId: session.user.id,
        nairaAmount,
        coinsAmount,
        proofImageUrl: publicUrlData.publicUrl,
        status: "PENDING",
      },
    });

    // Notify admin
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (admin) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          title: "New Funding Request 💰",
          message: `A client has submitted a payment proof for ₦${nairaAmount.toLocaleString()}. Review and approve to credit their wallet.`,
          link: "/admin/fund-requests",
        },
      });
    }

    return NextResponse.json(
      { message: "Funding request submitted. Admin will review shortly.", id: fundingRequest.id },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[FUND REQUEST ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET — client checks their own funding requests
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);

    const requests = await prisma.fundingRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ requests });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}