import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/ai-prompt";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "학생만 사용할 수 있습니다" }, { status: 403 });
  }

  const { courseId } = await params;

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { studentId_courseId: { studentId: session.user.id, courseId } },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "이 수업에 등록되지 않았습니다" }, { status: 403 });
  }

  // 인스턴스 조회 또는 생성
  let instance = await prisma.aIInstance.findUnique({
    where: { courseId_studentId: { courseId, studentId: session.user.id } },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  // 기존 세션이 있으면 단계 정보와 함께 반환
  if (instance && instance.messages.length > 0) {
    const steps = await prisma.lessonStep.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
    });
    const currentStep = steps.find((s) => s.id === instance!.currentStepId) ?? steps[0] ?? null;

    // 현재 단계의 진행 상태
    const stepProgress = currentStep
      ? await prisma.stepProgress.findUnique({
          where: { instanceId_stepId: { instanceId: instance.id, stepId: currentStep.id } },
        })
      : null;

    return NextResponse.json({
      instanceId: instance.id,
      messages: instance.messages,
      steps,
      currentStep,
      stepProgress,
    });
  }

  if (!instance) {
    instance = await prisma.aIInstance.create({
      data: { courseId, studentId: session.user.id },
      include: { messages: true },
    });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      knowledgeFiles: { include: { knowledgeFile: true } },
      steps: { orderBy: { order: "asc" } },
    },
  });
  if (!course) return NextResponse.json({ error: "수업을 찾을 수 없습니다" }, { status: 404 });

  const knowledgeContent = course.knowledgeFiles
    .map((f) => `[${f.knowledgeFile.fileName}]\n${f.knowledgeFile.content}`)
    .join("\n\n");

  // 첫 단계 또는 기본 설정
  const firstStep = course.steps[0] ?? null;

  const systemPrompt = buildSystemPrompt({
    subject: course.subject,
    unit: course.unit,
    gradeLevel: course.gradeLevel,
    comprehensionLevel: course.comprehensionLevel,
    personality: firstStep?.aiPersonality ?? course.personality,
    knownTopics: JSON.parse(course.knownTopics),
    unknownTopics: JSON.parse(course.unknownTopics),
    misconceptions: JSON.parse(course.misconceptions),
    knowledgeContent: knowledgeContent || undefined,
    comprehensionState: {},
    stepFocus: firstStep?.aiFocus ?? undefined,
    aiName: firstStep?.aiName ?? "AI 학생",
    stepTitle: firstStep?.title ?? undefined,
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 300,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "안녕!" },
    ],
  });

  const greeting = response.choices[0].message.content ?? "안녕하세요 선생님!";

  // StepProgress 생성 (단계가 있는 경우, 재시도 시 중복 방지)
  let stepProgress = null;
  if (firstStep) {
    stepProgress = await prisma.stepProgress.upsert({
      where: { instanceId_stepId: { instanceId: instance.id, stepId: firstStep.id } },
      create: { instanceId: instance.id, stepId: firstStep.id },
      update: {},
    });
    await prisma.aIInstance.update({
      where: { id: instance.id },
      data: { currentStepId: firstStep.id },
    });
  }

  await prisma.message.create({
    data: {
      instanceId: instance.id,
      role: "ai",
      content: greeting,
      stepProgressId: stepProgress?.id ?? null,
    },
  });

  return NextResponse.json({
    instanceId: instance.id,
    messages: [{ role: "ai", content: greeting, createdAt: new Date() }],
    steps: course.steps,
    currentStep: firstStep,
    stepProgress,
  });
}
