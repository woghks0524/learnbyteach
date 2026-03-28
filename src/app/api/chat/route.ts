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
      course: { include: { knowledgeFiles: { include: { knowledgeFile: true } } } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!instance) {
    return NextResponse.json({ error: "인스턴스를 찾을 수 없습니다" }, { status: 404 });
  }

  // 학생 메시지 저장
  await prisma.message.create({
    data: { instanceId, role: "student", content: message },
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
    personality: course.personality,
    knownTopics: JSON.parse(course.knownTopics),
    unknownTopics: JSON.parse(course.unknownTopics),
    misconceptions: JSON.parse(course.misconceptions),
    knowledgeContent: knowledgeContent || undefined,
    comprehensionState: JSON.parse(instance.comprehensionState),
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

  const aiMessage = response.choices[0].message.content ?? "";

  await prisma.message.create({
    data: { instanceId, role: "ai", content: aiMessage },
  });

  // 이해도 상태 업데이트 (매 10개 메시지마다)
  const totalMessages = instance.messages.length + 2;
  if (totalMessages % 10 === 0) {
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

  return NextResponse.json({ message: aiMessage });
}
