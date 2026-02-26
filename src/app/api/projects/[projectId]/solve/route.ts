import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { prepareTesterData } from "@/lib/solver/constraints";
import { solve } from "@/lib/solver/z3-solver";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: {
      requirements: { include: { questionMappings: true } },
      segmentations: { include: { questionMappings: true } },
      testerApplicants: {
        include: { surveyResponses: true },
      },
      activeTestAssignments: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Guard: ensure screening step is completed
  const recruitmentSession = await prisma.recruitmentSession.findUnique({
    where: { projectId },
  });
  if (
    recruitmentSession?.currentStep === "screening" ||
    recruitmentSession?.currentStep === "mapping"
  ) {
    return NextResponse.json(
      { error: "Please complete the screening step first" },
      { status: 400 }
    );
  }

  // Load global blocklist and golden tickets
  const [blocklistEntries, goldenTicketEntries] = await Promise.all([
    prisma.blocklistEntry.findMany(),
    prisma.goldenTicketEntry.findMany(),
  ]);

  const blocklistedEmails = new Set(
    blocklistEntries
      .filter((e) => e.email)
      .map((e) => e.email!.toLowerCase())
  );
  const blocklistedUsernames = new Set(
    blocklistEntries
      .filter((e) => e.username)
      .map((e) => e.username!.toLowerCase())
  );
  const goldenTickets = new Map<string, number>();
  for (const gt of goldenTicketEntries) {
    if (gt.email) goldenTickets.set(gt.email.toLowerCase(), gt.priorityLevel);
    if (gt.username)
      goldenTickets.set(gt.username.toLowerCase(), gt.priorityLevel);
  }
  const activeTestEmails = new Set(
    project.activeTestAssignments.map((a) => a.email.toLowerCase())
  );

  const hardReqs = project.requirements.filter((r) => r.type === "HARD");
  const softReqs = project.requirements.filter((r) => r.type === "SOFT");

  // Prepare tester data
  const testerData = prepareTesterData(
    project.testerApplicants,
    hardReqs,
    softReqs,
    project.segmentations,
    blocklistedEmails,
    blocklistedUsernames,
    goldenTickets,
    activeTestEmails
  );

  // Run solver
  const result = await solve(testerData, {
    targetCount: project.targetCount,
    surplusCount: project.surplusCount,
    backupCount: project.backupCount,
    segmentations: project.segmentations.map((s) => ({
      id: s.id,
      name: s.name,
      targetPercentages: s.targetPercentages as Record<string, number>,
      tolerance: s.tolerance,
    })),
    weights: {
      communityScore: 1.0,
      goldenTicket: 5.0,
      activeTestPenalty: 3.0,
      tgtbtPenalty: 1.5,
      segmentationDeviation: 2.0,
      softRequirement: 1.0,
    },
  });

  // Save selections to DB
  await prisma.testerSelection.deleteMany({ where: { projectId } });

  const selectionData = [
    ...result.selected.map((id, i) => ({
      projectId,
      testerId: id,
      status: "SELECTED" as const,
      solverScore: result.scores[id] || 0,
      rank: i + 1,
    })),
    ...result.backup.map((id, i) => ({
      projectId,
      testerId: id,
      status: "BACKUP" as const,
      solverScore: result.scores[id] || 0,
      rank: result.selected.length + i + 1,
    })),
  ];

  await prisma.testerSelection.createMany({ data: selectionData });

  // Update project status
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "SOLVED" },
  });

  await prisma.recruitmentSession.update({
    where: { projectId },
    data: { currentStep: "review" },
  });

  return NextResponse.json({
    selectedCount: result.selected.length,
    backupCount: result.backup.length,
    demographics: result.demographics,
    solveTimeMs: result.solveTimeMs,
  });
}
