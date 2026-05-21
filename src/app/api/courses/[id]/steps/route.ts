import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET: 수업 단계 목록 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { id } = await params;
  const steps = await prisma.lessonStep.findMany({
    where: { courseId: id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(steps);
}

// POST: 단계 생성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { id: courseId } = await params;

  // 내 수업인지 확인
  const course = await prisma.course.findUnique({ where: { id: courseId, teacherId: session.user.id } });
  if (!course) return NextResponse.json({ error: "수업을 찾을 수 없습니다" }, { status: 404 });

  const body = await req.json();

  // 현재 마지막 order 계산
  const lastStep = await prisma.lessonStep.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
  });
  const nextOrder = (lastStep?.order ?? 0) + 1;

  const step = await prisma.lessonStep.create({
    data: {
      courseId,
      order: body.order ?? nextOrder,
      title: body.title,
      description: body.description ?? null,
      aiName: body.aiName ?? "AI 학생",
      aiAvatar: body.aiAvatar ?? "default",
      aiPersonality: body.aiPersonality ?? "curious",
      aiFocus: body.aiFocus ?? null,
      completionCriteria: body.completionCriteria ?? null,
      minMessages: body.minMessages ?? 6,
    },
  });

  return NextResponse.json(step);
}
