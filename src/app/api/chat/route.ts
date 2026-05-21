import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildSystemPrompt, buildComprehensionUpdatePrompt } from "@/lib/ai-prompt";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "학생만 사용할 수 있습니다" }, { status: 403 });
  }

  const { instanceId, message } = await req.json();

  const instance = await prisma.aIInstance.findUnique({
    where: { id: instanceId, studentId: session.user.id },
    include: {
      course: {
        include: {
          knowledgeFiles: { include: { knowledgeFile: true } },
          steps: { orderBy: { order: "asc" } },
        },
      },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!instance) {
    return NextResponse.json({ error: "인스턴스를 찾을 수 없습니다" }, { status: 404 });
  }

  // 현재 단계 조회
  const currentStep = instance.currentStepId
    ? (instance.course.steps.find((s) => s.id === instance.currentStepId) ?? instance.course.steps[0] ?? null)
    : (instance.course.steps[0] ?? null);

  // 현재 단계의 StepProgress 조회 (메시지 저장용)
  const stepProgress = currentStep
    ? await prisma.stepProgress.findUnique({
        where: { instanceId_stepId: { instanceId, stepId: currentStep.id } },
      })
    : null;

  // 학생 메시지 저장
  await prisma.message.create({
    data: { instanceId, role: "student", content: message, stepProgressId: stepProgress?.id ?? null },
  });

  const course = instance.course;
  const knowledgeContent = course.knowledgeFiles
    .map((f) => `[${f.knowledgeFile.fileName}]\n${f.knowledgeFile.content}`)
    .join("\n\n");

  const systemPrompt = buildSystemPrompt({
    subject: course.subject,
    unit: course.unit,
    gradeLevel: course.gradeLevel,
    comprehensionLevel: course.comprehensionLevel,
    personality: currentStep?.aiPersonality ?? course.personality,
    knownTopics: JSON.parse(course.knownTopics),
    unknownTopics: JSON.parse(course.unknownTopics),
    misconceptions: JSON.parse(course.misconceptions),
    knowledgeContent: knowledgeContent || undefined,
    comprehensionState: JSON.parse(instance.comprehensionState),
    stepFocus: currentStep?.aiFocus ?? undefined,
    aiName: currentStep?.aiName ?? "AI 학생",
    stepTitle: currentStep?.title ?? undefined,
    completionCriteria: currentStep?.completionCriteria ?? undefined,
  });

  const conversationMessages = [
    ...instance.messages.map((m) => ({
      role: (m.role === "student" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 500,
    messages: [
      { role: "system", content: systemPrompt },
      ...conversationMessages,
    ],
  });

  const rawAiMessage = response.choices[0].message.content ?? "";
  const STEP_COMPLETE_TOKEN = "[STEP_COMPLETE]";
  const stepCompleted =
    currentStep != null &&
    stepProgress != null &&
    currentStep.completionCriteria != null &&
    rawAiMessage.includes(STEP_COMPLETE_TOKEN);
  const aiMessage = rawAiMessage.replace(STEP_COMPLETE_TOKEN, "").trim();

  await prisma.message.create({
    data: { instanceId, role: "ai", content: aiMessage, stepProgressId: stepProgress?.id ?? null },
  });

  let transitionMessage: string | null = null;
  let newStep: typeof currentStep | null = null;
  let allStepsCompleted = false;

  if (stepCompleted && currentStep && stepProgress) {
    await prisma.stepProgress.update({
      where: { id: stepProgress.id },
      data: { completed: true },
    });

    const nextStep = course.steps.find((s) => s.order > currentStep.order) ?? null;

    if (nextStep) {
      const nextProgress = await prisma.stepProgress.upsert({
        where: { instanceId_stepId: { instanceId, stepId: nextStep.id } },
        create: { instanceId, stepId: nextStep.id },
        update: {},
      });

      await prisma.aIInstance.update({
        where: { id: instanceId },
        data: { currentStepId: nextStep.id },
      });

      const transitionSystemPrompt = buildSystemPrompt({
        subject: course.subject,
        unit: course.unit,
        gradeLevel: course.gradeLevel,
        comprehensionLevel: course.comprehensionLevel,
        personality: nextStep.aiPersonality,
        knownTopics: JSON.parse(course.knownTopics),
        unknownTopics: JSON.parse(course.unknownTopics),
        misconceptions: JSON.parse(course.misconceptions),
        knowledgeContent: knowledgeContent || undefined,
        comprehensionState: JSON.parse(instance.comprehensionState),
        stepFocus: nextStep.aiFocus ?? undefined,
        aiName: nextStep.aiName,
        stepTitle: nextStep.title,
        completionCriteria: nextStep.completionCriteria ?? undefined,
      });

      const transitionResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 200,
        messages: [
          { role: "system", content: transitionSystemPrompt },
          {
            role: "user",
            content:
              "(전 주제는 잘 배웠고, 같은 선생님과 같은 수업에서 새로운 주제로 자연스럽게 넘어가는 상황이야. 짧고 자연스럽게 새 주제로 호기심이나 모름을 살짝 드러내며 운을 띄워. '이제 다음 단계' 같은 메타적 표현은 절대 쓰지 마.)",
          },
        ],
      });

      const transitionText = (transitionResp.choices[0].message.content ?? "").replace(STEP_COMPLETE_TOKEN, "").trim();

      await prisma.message.create({
        data: { instanceId, role: "ai", content: transitionText, stepProgressId: nextProgress.id },
      });

      transitionMessage = transitionText;
      newStep = nextStep;
    } else {
      allStepsCompleted = true;
    }
  }

  // 이해도 상태 업데이트 (매 5번 대화마다 = 10개 메시지)
  const totalMessages = instance.messages.length + 2;
  if (totalMessages % 5 === 0) {
    try {
      const allMessages = [
        ...instance.messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "student", content: message },
        { role: "ai", content: aiMessage },
      ];

      const updatePrompt = buildComprehensionUpdatePrompt(
        JSON.parse(instance.comprehensionState),
        allMessages
      );

      const stateResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1000,
        messages: [{ role: "user", content: updatePrompt }],
      });

      const stateText = stateResponse.choices[0].message.content ?? "{}";
      const jsonMatch = stateText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        await prisma.aIInstance.update({
          where: { id: instanceId },
          data: { comprehensionState: jsonMatch[0] },
        });
      }
    } catch {
      // 이해도 업데이트 실패해도 대화는 계속
    }
  }

  return NextResponse.json({
    message: aiMessage,
    transitionMessage,
    newStep,
    allStepsCompleted,
  });
}
