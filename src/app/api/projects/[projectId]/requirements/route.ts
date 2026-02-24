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
  const [requirements, segmentations] = await Promise.all([
    prisma.requirement.findMany({ where: { projectId } }),
    prisma.segmentation.findMany({ where: { projectId } }),
  ]);

  return NextResponse.json({ requirements, segmentations });
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
  const { requirements, segmentations } = body;

  // Replace all requirements and segmentations
  await prisma.requirement.deleteMany({ where: { projectId } });
  await prisma.segmentation.deleteMany({ where: { projectId } });

  if (requirements?.length) {
    await prisma.requirement.createMany({
      data: requirements.map(
        (r: {
          name: string;
          description?: string;
          type: string;
          acceptedValues: string[];
          weight?: number;
        }) => ({
          projectId,
          name: r.name,
          description: r.description || null,
          type: r.type,
          acceptedValues: r.acceptedValues,
          weight: r.weight || 1.0,
        })
      ),
    });
  }

  if (segmentations?.length) {
    await prisma.segmentation.createMany({
      data: segmentations.map(
        (s: {
          name: string;
          targetPercentages: Record<string, number>;
          tolerance?: number;
        }) => ({
          projectId,
          name: s.name,
          targetPercentages: s.targetPercentages,
          tolerance: s.tolerance || 5.0,
        })
      ),
    });
  }

  return NextResponse.json({ success: true });
}
