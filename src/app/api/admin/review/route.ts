import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    settlementId: string;
    verificationStatus: "submitted" | "reviewed" | "verified" | "rejected";
    reviewerNotes?: string;
    userId?: string;
  };

  const current = await prisma.settlement.findUnique({ where: { id: body.settlementId } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.settlement.update({
    where: { id: body.settlementId },
    data: {
      verificationStatus: body.verificationStatus,
      reviewerNotes: body.reviewerNotes,
    },
  });

  await prisma.auditLog.create({
    data: {
      settlementId: body.settlementId,
      action: "review_status_change",
      oldValueJson: JSON.stringify({
        verificationStatus: current.verificationStatus,
        reviewerNotes: current.reviewerNotes,
      }),
      newValueJson: JSON.stringify({
        verificationStatus: updated.verificationStatus,
        reviewerNotes: updated.reviewerNotes,
      }),
      userId: body.userId,
    },
  });

  return NextResponse.json(updated);
}
