import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildStepGenPrompt } from "@/lib/ai-prompt";
import { SETUP_MODEL } from "@/lib/constants";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 부분(차시) 단계 생성 — 이미 있는 수업에, 교사가 적은 '이 부분'에 대한 학습 단계 1~3개만 만들어 돌려준다(저장은 안 함).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }
  const { id: courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId, teacherId: session.user.id },
    include: {
      knowledgeFiles: { include: { knowledgeFile: true } },
      steps: { orderBy: { order: "asc" }, select: { title: true } },
    },
  });
  if (!course) return NextResponse.json({ error: "수업을 찾을 수 없습니다" }, { status: 404 });

  const { focus } = await req.json();
  if (typeof focus !== "string" || !focus.trim()) {
    return NextResponse.json({ error: "어떤 부분에 대한 단계인지 적어주세요" }, { status: 400 });
  }

  const answerKey = course.knowledgeFiles
    .map((f) => `[${f.knowledgeFile.fileName}]\n${f.knowledgeFile.content}`)
    .join("\n\n");

  try {
    const resp = await openai.chat.completions.create({
      model: SETUP_MODEL,
      max_completion_tokens: 2500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: buildStepGenPrompt({
            grade: course.gradeLevel,
            subject: course.subject,
            unit: course.unit,
            focus: focus.trim(),
            answerKey: answerKey || undefined,
            existingTitles: course.steps.map((s) => s.title),
          }),
        },
      ],
    });

    const parsed = JSON.parse(resp.choices[0].message.content ?? "{}");
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps
          .filter((s: unknown) => s && typeof s === "object")
          .map((s: Record<string, unknown>) => ({
            title: String(s.title ?? "").trim(),
            aiFocus: String(s.aiFocus ?? "").trim(),
            completionCriteria: String(s.completionCriteria ?? "").trim(),
          }))
          .filter((s: { title: string }) => s.title)
          .slice(0, 3)
      : [];

    if (steps.length === 0) {
      return NextResponse.json({ error: "단계를 만들지 못했어요. 다시 시도해 주세요." }, { status: 500 });
    }
    return NextResponse.json({ steps });
  } catch {
    return NextResponse.json({ error: "단계 생성에 실패했어요. 다시 시도해 주세요." }, { status: 500 });
  }
}
