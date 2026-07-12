import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/ai-prompt";
import { CHAT_MODEL, parseJsonArray, parseJsonObject } from "@/lib/constants";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 학생이 "다음으로" 버튼을 눌렀을 때만 다음 단계로 진입한다.
// (완료 판정은 chat에서, 실제 전환은 여기서 — 마지막 메시지를 읽고 넘어가도록)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "학생만 사용할 수 있습니다" }, { status: 403 });
  }

  const { courseId } = await params;

  const instance = await prisma.aIInstance.findUnique({
    where: { courseId_studentId: { courseId, studentId: session.user.id } },
    include: {
      course: {
        include: {
          knowledgeFiles: { include: { knowledgeFile: true } },
          steps: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!instance) return NextResponse.json({ error: "인스턴스를 찾을 수 없습니다" }, { status: 404 });

  const course = instance.course;
  const currentStep = course.steps.find((s) => s.id === instance.currentStepId) ?? course.steps[0] ?? null;
  if (!currentStep) return NextResponse.json({ error: "단계가 없습니다" }, { status: 400 });

  // 현재 단계가 실제로 완료됐는지 확인
  const curProgress = await prisma.stepProgress.findUnique({
    where: { instanceId_stepId: { instanceId: instance.id, stepId: currentStep.id } },
  });
  if (!curProgress?.completed) {
    return NextResponse.json({ error: "아직 이 단계를 다 배우지 않았어요" }, { status: 400 });
  }

  const nextStep = course.steps.find((s) => s.order > currentStep.order) ?? null;
  if (!nextStep) {
    return NextResponse.json({ allStepsCompleted: true });
  }

  const nextProgress = await prisma.stepProgress.upsert({
    where: { instanceId_stepId: { instanceId: instance.id, stepId: nextStep.id } },
    create: { instanceId: instance.id, stepId: nextStep.id },
    update: {},
  });
  await prisma.aIInstance.update({
    where: { id: instance.id },
    data: { currentStepId: nextStep.id },
  });

  const knowledgeContent = course.knowledgeFiles
    .map((f) => `[${f.knowledgeFile.fileName}]\n${f.knowledgeFile.content}`)
    .join("\n\n");

  const systemPrompt = buildSystemPrompt({
    subject: course.subject,
    unit: course.unit,
    gradeLevel: course.gradeLevel,
    comprehensionLevel: course.comprehensionLevel,
    personality: course.personality,
    knownTopics: parseJsonArray(course.knownTopics),
    unknownTopics: parseJsonArray(course.unknownTopics),
    misconceptions: parseJsonArray(course.misconceptions),
    knowledgeContent: knowledgeContent || undefined,
    comprehensionState: parseJsonObject(instance.comprehensionState),
    stepFocus: nextStep.aiFocus ?? undefined,
    aiName: course.aiName,
    stepTitle: nextStep.title,
    completionCriteria: nextStep.completionCriteria ?? undefined,
  });

  let greeting = "안녕하세요 선생님! 이번엔 또 뭐 배워요?";
  try {
    const resp = await openai.chat.completions.create({
      model: CHAT_MODEL,
      max_tokens: 120,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            "(전 주제는 잘 배웠고, 같은 선생님과 같은 수업에서 새로운 주제로 자연스럽게 넘어가는 상황이야. 짧고 다정하게 새 주제로 호기심이나 모름을 살짝 드러내며 운을 띄워. '이제 다음 단계' 같은 메타적 표현은 절대 쓰지 마.)",
        },
      ],
    });
    greeting = (resp.choices[0].message.content ?? greeting).trim();
  } catch {
    // 실패해도 기본 인사로 진행
  }

  await prisma.message.create({
    data: { instanceId: instance.id, role: "ai", content: greeting, stepProgressId: nextProgress.id },
  });

  return NextResponse.json({
    newStep: nextStep,
    message: greeting,
    stepId: nextStep.id,
  });
}
