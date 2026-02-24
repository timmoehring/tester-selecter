import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { generateCSV, type ExportColumns } from "@/lib/export/csv-export";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const columns = (searchParams.get("columns") || "both") as ExportColumns;
  const statusFilter = searchParams.get("status") || "APPROVED";

  const selections = await prisma.testerSelection.findMany({
    where: {
      projectId,
      status: statusFilter === "ALL" ? undefined : statusFilter as "APPROVED" | "SELECTED",
    },
    include: { tester: true },
    orderBy: { rank: "asc" },
  });

  const rows = selections.map((s) => ({
    username: s.tester.username,
    email: s.tester.email,
    status: s.status,
    sentimentGrade: s.sentimentGrade || undefined,
    communityScore: s.tester.communityScore,
    rank: s.rank || undefined,
  }));

  const csv = generateCSV(rows, columns);

  // Update project status
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "COMPLETED" },
  });

  await prisma.recruitmentSession.update({
    where: { projectId },
    data: { currentStep: "export" },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="testers-${projectId}.csv"`,
    },
  });
}
