import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { batchAnalyzeSentiment } from "@/lib/analysis/sentiment";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  // Get selected testers with their "why" responses
  const selections = await prisma.testerSelection.findMany({
    where: { projectId, sentimentGrade: null },
    include: {
      tester: {
        include: { surveyResponses: { include: { surveyQuestion: true } } },
      },
    },
  });

  // Find "why" questions (free text questions with keywords like "why", "reason", "explain")
  const whyQuestions = await prisma.surveyQuestion.findMany({
    where: {
      projectId,
      questionType: "text",
      OR: [
        { questionText: { contains: "why", mode: "insensitive" } },
        { questionText: { contains: "reason", mode: "insensitive" } },
        { questionText: { contains: "explain", mode: "insensitive" } },
        { questionText: { contains: "describe", mode: "insensitive" } },
        { questionText: { contains: "tell us", mode: "insensitive" } },
      ],
    },
  });

  const whyQuestionIds = new Set(whyQuestions.map((q) => q.id));

  // Prepare items for batch analysis
  const items: { id: string; text: string; context?: string }[] = [];

  for (const sel of selections) {
    // Find the "why" response for this tester
    const whyResponse = sel.tester.surveyResponses.find(
      (r) => whyQuestionIds.has(r.surveyQuestionId) && r.responseValue.trim()
    );

    if (whyResponse) {
      const question = whyResponse.surveyQuestion;
      items.push({
        id: sel.id,
        text: whyResponse.responseValue,
        context: question?.questionText,
      });
    }
  }

  if (items.length === 0) {
    return NextResponse.json({
      analyzed: 0,
      message: "No free-text responses to analyze",
    });
  }

  // Run batch sentiment analysis
  const results = await batchAnalyzeSentiment(items);

  // Update selections with sentiment grades
  for (const [selectionId, result] of results) {
    await prisma.testerSelection.update({
      where: { id: selectionId },
      data: {
        sentimentGrade: result.grade,
        sentimentNote: result.justification,
      },
    });
  }

  return NextResponse.json({ analyzed: results.size });
}
