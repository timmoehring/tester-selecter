import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { autoMap } from "@/lib/parsing/auto-mapper";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const [questions, mappings, requirements, segmentations] = await Promise.all([
    prisma.surveyQuestion.findMany({
      where: { projectId },
      orderBy: { columnIndex: "asc" },
    }),
    prisma.questionMapping.findMany({
      where: { projectId },
      include: { requirement: true, segmentation: true },
    }),
    prisma.requirement.findMany({ where: { projectId } }),
    prisma.segmentation.findMany({ where: { projectId } }),
  ]);

  return NextResponse.json({ questions, mappings, requirements, segmentations });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const body = await req.json();
  const { action } = body;

  if (action === "auto-map") {
    // Run auto-mapper
    const [questions, requirements, segmentations] = await Promise.all([
      prisma.surveyQuestion.findMany({
        where: { projectId },
        orderBy: { columnIndex: "asc" },
      }),
      prisma.requirement.findMany({ where: { projectId } }),
      prisma.segmentation.findMany({ where: { projectId } }),
    ]);

    const targets = [
      ...requirements.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        type: "requirement" as const,
      })),
      ...segmentations.map((s) => ({
        id: s.id,
        name: s.name,
        description: null,
        type: "segmentation" as const,
      })),
    ];

    const candidates = autoMap(questions, targets);

    // Clear existing mappings
    await prisma.questionMapping.deleteMany({ where: { projectId } });

    // Create new mappings
    for (const candidate of candidates) {
      await prisma.questionMapping.create({
        data: {
          projectId,
          surveyQuestionId: candidate.surveyQuestionId,
          requirementId:
            candidate.targetType === "requirement"
              ? candidate.targetId
              : null,
          segmentationId:
            candidate.targetType === "segmentation"
              ? candidate.targetId
              : null,
          confidence: candidate.confidence,
          isConfirmed: false,
        },
      });
    }

    return NextResponse.json({ mapped: candidates.length });
  }

  if (action === "save") {
    // Save manual mappings
    const { mappings } = body as {
      mappings: {
        surveyQuestionId: string;
        requirementId?: string;
        segmentationId?: string;
        isConfirmed: boolean;
      }[];
    };

    await prisma.questionMapping.deleteMany({ where: { projectId } });

    for (const m of mappings) {
      if (m.requirementId || m.segmentationId) {
        await prisma.questionMapping.create({
          data: {
            projectId,
            surveyQuestionId: m.surveyQuestionId,
            requirementId: m.requirementId || null,
            segmentationId: m.segmentationId || null,
            confidence: 1.0,
            isConfirmed: m.isConfirmed,
          },
        });
      }
    }

    // Update project status
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "MAPPED" },
    });

    await prisma.recruitmentSession.update({
      where: { projectId },
      data: { currentStep: "screening" },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
