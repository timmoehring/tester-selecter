import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; testerId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, testerId } = await params;
  const body = await req.json();
  const { status, reviewNotes } = body;

  const selection = await prisma.testerSelection.findFirst({
    where: { projectId, testerId },
  });

  if (!selection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (reviewNotes !== undefined) updateData.reviewNotes = reviewNotes;

  await prisma.testerSelection.update({
    where: { id: selection.id },
    data: updateData,
  });

  // If rejected, backfill from backup
  if (status === "REJECTED") {
    const nextBackup = await prisma.testerSelection.findFirst({
      where: { projectId, status: "BACKUP" },
      orderBy: { rank: "asc" },
    });

    if (nextBackup) {
      await prisma.testerSelection.update({
        where: { id: nextBackup.id },
        data: { status: "SELECTED" },
      });
    }
  }

  // Update session progress
  await prisma.recruitmentSession.update({
    where: { projectId },
    data: { lastReviewedTesterId: testerId },
  });

  return NextResponse.json({ success: true });
}
