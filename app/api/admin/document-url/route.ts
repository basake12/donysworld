import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDocumentSignedUrl } from "@/lib/supabase";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse("Unauthorized", 401);
    if (session.user.role !== "ADMIN")
      return errorResponse("Admin access required", 403);

    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");

    if (!path) return errorResponse("Document path is required");

    const url = await getDocumentSignedUrl(path);

    return NextResponse.json({ url });
  } catch (err: any) {
    const message: string = err?.message ?? "";

    // File doesn't exist in storage — seed/placeholder data
    if (
      message.includes("Object not found") ||
      message.includes("not found") ||
      message.includes("does not exist")
    ) {
      return NextResponse.json(
        { error: "Document not yet uploaded" },
        { status: 404 }
      );
    }

    console.error("[DOCUMENT URL ERROR]", err);
    return NextResponse.json(
      { error: "Could not generate document URL" },
      { status: 500 }
    );
  }
}