import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { buildSystemPrompt } from "@/lib/ai-prompt";
import { CHAT_MODEL, parseJsonArray } from "@/lib/constants";

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

    // 메시지마다 어느 단계 것인지(stepId) 붙인다 — 학생 화면의 단계 탭 분류용
    const progresses = await prisma.stepProgress.findMany({
      where: { instanceId: instance.id },
      select: { id: true, stepId: true },
    });
    const pmap = new Map(progresses.map((p) => [p.id, p.stepId]));
    const messages = instance.messages.map((m) => ({
      ...m,
      stepId: m.stepProgressId ? pmap.get(m.stepProgressId) ?? null : null,
    }));

    // 현재 단계가 이미 완료됐는데 아직 안 넘어간 상태면(껐다 켜도) "다음으로" 버튼을 띄우도록 알려준다
    let pendingNextStep: { id: string; order: number; title: string } | null = null;
    let allStepsCompleted = false;
    if (currentStep && stepProgress?.completed) {
      const nx = steps.find((s) => s.order > currentStep.order) ?? null;
      if (nx) pendingNextStep = { id: nx.id, order: nx.order, title: nx.title };
      else allStepsCompleted = true;
    }

    return NextResponse.json({
      instanceId: instance.id,
      messages,
      steps,
      currentStep,
      stepProgress,
      pendingNextStep,
      allStepsCompleted,
    });
  }

  if (!instance) {
    // 동시 요청(개발 모드 이펙트 2회 실행, 더블클릭 등)이면 create가 유니크 제약(P2002)에 걸린다.
    // 그 경우 진 쪽은 이미 만들어진 인스턴스를 다시 읽어와서 그대로 이어간다 — 500/중복 인사 방지.
    try {
      instance = await prisma.aIInstance.create({
        data: { courseId, studentId: session.user.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const existing = await prisma.aIInstance.findUnique({
          where: { courseId_studentId: { courseId, studentId: session.user.id } },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        });
        const steps = await prisma.lessonStep.findMany({ where: { courseId }, orderBy: { order: "asc" } });
        const currentStep = steps.find((s) => s.id === existing?.currentStepId) ?? steps[0] ?? null;
        const stepProgress = existing && currentStep
          ? await prisma.stepProgress.findUnique({
              where: { instanceId_stepId: { instanceId: existing.id, stepId: currentStep.id } },
            })
          : null;
        return NextResponse.json({
          instanceId: existing!.id,
          messages: existing!.messages,
          steps,
          currentStep,
          stepProgress,
        });
      }
      throw e;
    }
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
    knownTopics: parseJsonArray(course.knownTopics),
    unknownTopics: parseJsonArray(course.unknownTopics),
    misconceptions: parseJsonArray(course.misconceptions),
    knowledgeContent: knowledgeContent || undefined,
    comprehensionState: {},
    stepFocus: firstStep?.aiFocus ?? undefined,
    aiName: firstStep?.aiName ?? "AI 학생",
    stepTitle: firstStep?.title ?? undefined,
  });

  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
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
