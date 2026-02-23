import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { parseFile, parseActiveTests } from "@/lib/parsing/csv-parser";
import { detectTGTBTFlags } from "@/lib/analysis/tgtbt";

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
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const surveyFile = formData.get("surveyFile") as File | null;
  const activeTestsFile = formData.get("activeTestsFile") as File | null;
  const usernameCol = (formData.get("usernameCol") as string) || "username";
  const emailCol = (formData.get("emailCol") as string) || "email";
  const communityScoreCol = (formData.get("communityScoreCol") as string) || "community_score";

  if (!surveyFile) {
    return NextResponse.json(
      { error: "Survey file is required" },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await surveyFile.arrayBuffer());
    const parsed = parseFile(buffer, surveyFile.name);

    // Clear existing data for this project
    await prisma.surveyResponse.deleteMany({
      where: { tester: { projectId } },
    });
    await prisma.testerApplicant.deleteMany({ where: { projectId } });
    await prisma.surveyQuestion.deleteMany({ where: { projectId } });
    await prisma.activeTestAssignment.deleteMany({ where: { projectId } });

    // Create survey questions
    const questions = await Promise.all(
      parsed.headers.map((header, i) =>
        prisma.surveyQuestion.create({
          data: {
            projectId,
            questionText: header,
            columnIndex: i,
            detectedOptions: parsed.detectedOptions[header] || [],
            questionType:
              (parsed.detectedOptions[header]?.length || 0) > 0
                ? "multiple_choice"
                : "text",
          },
        })
      )
    );

    // Compute TGTBT flags
    const tgtbtFlags = detectTGTBTFlags(parsed.rows, parsed.headers, parsed.detectedOptions);

    // Create tester applicants + survey responses
    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const username = row[usernameCol] || `tester_${i + 1}`;
      const email = row[emailCol] || `tester_${i + 1}@unknown.com`;
      const communityScore = parseFloat(row[communityScoreCol]) || 0;

      const tester = await prisma.testerApplicant.create({
        data: {
          projectId,
          username,
          email: email.toLowerCase(),
          communityScore,
          rawResponses: row,
          tgtbtExtreme: tgtbtFlags[i]?.extreme || false,
          tgtbtOutlier: tgtbtFlags[i]?.outlier || false,
        },
      });

      // Create survey responses
      const responseData = questions.map((q) => ({
        testerId: tester.id,
        surveyQuestionId: q.id,
        responseValue: row[q.questionText] || "",
        normalizedValue: (row[q.questionText] || "").toLowerCase().trim(),
      }));

      await prisma.surveyResponse.createMany({ data: responseData });
    }

    // Handle active tests file
    if (activeTestsFile) {
      const atBuffer = Buffer.from(await activeTestsFile.arrayBuffer());
      const activeTests = parseActiveTests(atBuffer, activeTestsFile.name);
      await prisma.activeTestAssignment.createMany({
        data: activeTests.map((at) => ({
          projectId,
          email: at.email.toLowerCase(),
          username: at.username,
          testName: at.testName,
        })),
      });
    }

    // Update project status
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "UPLOADED" },
    });

    await prisma.recruitmentSession.update({
      where: { projectId },
      data: { currentStep: "requirements" },
    });

    return NextResponse.json({
      success: true,
      testerCount: parsed.rows.length,
      questionCount: parsed.headers.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parse error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
