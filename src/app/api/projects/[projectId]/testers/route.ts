import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const selections = await prisma.testerSelection.findMany({
    where: { projectId },
    include: {
      tester: {
        include: {
          surveyResponses: {
            include: { surveyQuestion: true },
          },
        },
      },
    },
    orderBy: { rank: "asc" },
  });

  // Load requirements and mappings for color-coding
  const [requirements, mappings, activeTests, goldenTickets] =
    await Promise.all([
      prisma.requirement.findMany({ where: { projectId } }),
      prisma.questionMapping.findMany({
        where: { projectId },
        include: { requirement: true, segmentation: true },
      }),
      prisma.activeTestAssignment.findMany({ where: { projectId } }),
      prisma.goldenTicketEntry.findMany(),
    ]);

  const activeTestEmails = new Set(
    activeTests.map((a) => a.email.toLowerCase())
  );
  const goldenTicketEmails = new Set(
    goldenTickets.filter((g) => g.email).map((g) => g.email!.toLowerCase())
  );
  const goldenTicketUsernames = new Set(
    goldenTickets
      .filter((g) => g.username)
      .map((g) => g.username!.toLowerCase())
  );

  const enriched = selections.map((sel) => {
    const isOnActiveTest = activeTestEmails.has(
      sel.tester.email.toLowerCase()
    );
    const isGoldenTicket =
      goldenTicketEmails.has(sel.tester.email.toLowerCase()) ||
      goldenTicketUsernames.has(sel.tester.username.toLowerCase());

    return {
      ...sel,
      isOnActiveTest,
      isGoldenTicket,
    };
  });

  return NextResponse.json({
    selections: enriched,
    requirements,
    mappings,
  });
}
