import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { testerApplicants: true } },
    },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, targetCount, surplusCount, backupCount } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description || null,
      targetCount: targetCount || 50,
      surplusCount: surplusCount || 5,
      backupCount: backupCount || 20,
      userId: session.user.id,
    },
  });

  // Create recruitment session for tracking
  await prisma.recruitmentSession.create({
    data: {
      projectId: project.id,
      currentStep: "upload",
    },
  });

  return NextResponse.json(project, { status: 201 });
}
