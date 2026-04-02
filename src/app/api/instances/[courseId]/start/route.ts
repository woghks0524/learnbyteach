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

  // 수업 등록 확인
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: {
      studentId_courseId: {
        studentId: session.user.id,
        courseId,
      },
    },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "이 수업에 등록되지 않았습니다" }, { status: 403 });
  }

  // 인스턴스 조회 또는 생성
  let instance = await prisma.aIInstance.findUnique({
    where: {
      courseId_studentId: {
        courseId,
        studentId: session.user.id,
      },
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (instance && instance.messages.length > 0) {
    return NextResponse.json({
      instanceId: instance.id,
      messages: instance.messages,
    });
  }

  if (!instance) {
    instance = await prisma.aIInstance.create({
      data: { courseId, studentId: session.user.id },
      include: { messages: true },
    });
  }

  // 수업(코스) 정보 가져오기
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { knowledgeFiles: { include: { knowledgeFile: true } } },
  });

  if (!course) {
    return NextResponse.json({ error: "수업을 찾을 수 없습니다" }, { status: 404 });
  }

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
    comprehensionState: {},
  });

  // AI 첫 인사
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 300,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "안녕!" },
    ],
  });

  const greeting = response.choices[0].message.content ?? "안녕하세요 선생님!";

  await prisma.message.create({
    data: { instanceId: instance.id, role: "ai", content: greeting },
  });

  return NextResponse.json({
    instanceId: instance.id,
    messages: [{ role: "ai", content: greeting, createdAt: new Date() }],
  });
}
