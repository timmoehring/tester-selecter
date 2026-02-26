import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { runScreening, type TesterInput } from "@/lib/analysis/screening";

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
      testerApplicants: {
        include: {
          surveyResponses: {
            include: { surveyQuestion: true },
          },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Transform to TesterInput format
  const testers: TesterInput[] = project.testerApplicants.map((applicant) => ({
    id: applicant.id,
    username: applicant.username,
    email: applicant.email,
    responses: applicant.surveyResponses.map((r) => ({
      questionText: r.surveyQuestion.questionText,
      questionType: r.surveyQuestion.questionType,
      value: r.responseValue,
    })),
  }));

  // Run screening
  const results = await runScreening(testers);

  // Delete previous flags (idempotent re-runs)
  await prisma.testerScreeningFlag.deleteMany({ where: { projectId } });

  // Reset all screening exclusions for this project
  await prisma.testerApplicant.updateMany({
    where: { projectId },
    data: { screeningExcluded: false },
  });

  // Insert new flags
  const flagRecords = results.flatMap((result) =>
    result.flags.map((f) => ({
      projectId,
      testerId: result.testerId,
      flag: f.flag as "FAKE_NAME" | "LOW_EFFORT" | "DUPLICATE_PATTERN" | "GENERIC_RESPONSE",
      reason: f.reason,
      excluded: false,
    }))
  );

  if (flagRecords.length > 0) {
    // Use createMany but handle the unique constraint by inserting one-by-one
    // since a tester might have multiple flags of the same type from different detectors
    // We'll deduplicate by keeping the first flag per (testerId, flag) combo
    const seen = new Set<string>();
    const dedupedRecords = flagRecords.filter((r) => {
      const key = `${r.testerId}:${r.flag}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await prisma.testerScreeningFlag.createMany({ data: dedupedRecords });
  }

  // Update workflow step
  await prisma.recruitmentSession.update({
    where: { projectId },
    data: { currentStep: "screening" },
  });

  const flaggedTesterIds = new Set(results.map((r) => r.testerId));

  return NextResponse.json({
    flaggedCount: flaggedTesterIds.size,
    totalApplicants: testers.length,
    totalFlags: flagRecords.length,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const flags = await prisma.testerScreeningFlag.findMany({
    where: { projectId },
    include: {
      tester: {
        select: { id: true, username: true, email: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const totalApplicants = await prisma.testerApplicant.count({
    where: { projectId },
  });

  // Group by tester
  const testerMap = new Map<
    string,
    {
      testerId: string;
      username: string;
      email: string;
      flags: { id: string; flag: string; reason: string; excluded: boolean }[];
    }
  >();

  for (const f of flags) {
    if (!testerMap.has(f.testerId)) {
      testerMap.set(f.testerId, {
        testerId: f.testerId,
        username: f.tester.username,
        email: f.tester.email,
        flags: [],
      });
    }
    testerMap.get(f.testerId)!.flags.push({
      id: f.id,
      flag: f.flag,
      reason: f.reason,
      excluded: f.excluded,
    });
  }

  return NextResponse.json({
    flaggedTesters: Array.from(testerMap.values()),
    totalApplicants,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const body = await req.json();
  const { decisions } = body as {
    decisions: { testerId: string; excluded: boolean }[];
  };

  // Update flags and applicant records
  for (const decision of decisions) {
    await prisma.testerScreeningFlag.updateMany({
      where: { projectId, testerId: decision.testerId },
      data: { excluded: decision.excluded },
    });

    await prisma.testerApplicant.update({
      where: { id: decision.testerId },
      data: { screeningExcluded: decision.excluded },
    });
  }

  // Advance workflow step
  await prisma.recruitmentSession.update({
    where: { projectId },
    data: { currentStep: "selection" },
  });

  return NextResponse.json({ success: true });
}
