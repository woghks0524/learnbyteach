import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurriculumUnit } from "@/lib/curriculum";
import { buildCourseSetupPrompt } from "@/lib/ai-prompt";
import { SETUP_MODEL } from "@/lib/constants";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 교육과정 단원(+교사 업로드 자료) 기반 수업 설정 자동 생성(오개념·선수학습·학습단계 초안)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const { curriculumUnitId, knowledgeFileIds } = await req.json();
  const u = getCurriculumUnit(Number(curriculumUnitId));
  if (!u) {
    return NextResponse.json({ error: "단원을 찾을 수 없습니다" }, { status: 400 });
  }

  // 교사가 직접 선택한 지식파일 내용을 추가 참고자료로(본인 소유만)
  let extraMaterial = "";
  if (Array.isArray(knowledgeFileIds) && knowledgeFileIds.length > 0) {
    const files = await prisma.knowledgeFile.findMany({
      where: { id: { in: knowledgeFileIds }, teacherId: session.user.id },
      select: { fileName: true, content: true },
    });
    extraMaterial = files.map((f) => `[${f.fileName}]\n${f.content}`).join("\n\n").slice(0, 12000);
  }

  try {
    const resp = await openai.chat.completions.create({
      model: SETUP_MODEL,
      max_completion_tokens: 4000, // 추론 토큰 포함이라 넉넉히
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: buildCourseSetupPrompt({
            grade: `${u.grade}학년`,
            subject: u.subject,
            unit: u.unit,
            standards: u.standards,
            content: u.content,
            extraMaterial: extraMaterial || undefined,
          }),
        },
      ],
    });

    const parsed = JSON.parse(resp.choices[0].message.content ?? "{}");
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
    const level = ["low", "medium", "high"].includes(parsed.comprehensionLevel) ? parsed.comprehensionLevel : "medium";
    const personality = ["passive", "curious", "challenging"].includes(parsed.personality) ? parsed.personality : "curious";
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps
          .filter((s: unknown) => s && typeof s === "object")
          .map((s: Record<string, unknown>) => ({
            title: String(s.title ?? "").trim(),
            aiFocus: String(s.aiFocus ?? "").trim(),
            completionCriteria: String(s.completionCriteria ?? "").trim(),
          }))
          .filter((s: { title: string }) => s.title)
      : [];

    return NextResponse.json({
      misconceptions: arr(parsed.misconceptions),
      knownTopics: arr(parsed.knownTopics),
      unknownTopics: arr(parsed.unknownTopics),
      comprehensionLevel: level,
      personality,
      steps,
    });
  } catch {
    return NextResponse.json({ error: "자동 구성에 실패했습니다. 다시 시도해 주세요." }, { status: 500 });
  }
}
