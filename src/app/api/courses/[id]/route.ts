import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id } = await params;

  // 학생은 등록된 수업의 기본 정보만 조회 가능
  if (session.user.role === "student") {
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { studentId_courseId: { studentId: session.user.id, courseId: id } },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const course = await prisma.course.findUnique({
      where: { id },
      select: { id: true, name: true, subject: true, unit: true, gradeLevel: true, description: true },
    });
    if (!course) return NextResponse.json({ error: "수업을 찾을 수 없습니다" }, { status: 404 });
    return NextResponse.json(course);
  }

  // 교사는 자기 수업의 전체 정보 조회
  const course = await prisma.course.findUnique({
    where: { id, teacherId: session.user.id },
    include: {
      enrollments: {
        include: { student: { select: { id: true, name: true, email: true } } },
      },
      instances: {
        include: {
          student: { select: { id: true, name: true, email: true } },
          messages: { orderBy: { createdAt: "asc" } },
          stepProgress: {
            include: {
              step: true,
              _count: { select: { messages: true } },
            },
          },
        },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "수업을 찾을 수 없습니다" }, { status: 404 });
  }

  // 각 인스턴스에 'stuck' 플래그: 현재 단계에서 minMessages 초과했는데 완료 안 됨
  const withStuck = {
    ...course,
    instances: course.instances.map((inst) => {
      const currentProgress = inst.stepProgress.find((p) => p.stepId === inst.currentStepId);
      const stuck =
        currentProgress != null &&
        !currentProgress.completed &&
        currentProgress._count.messages > currentProgress.step.minMessages;
      return {
        ...inst,
        stuck,
        currentStepTitle: currentProgress?.step.title ?? null,
      };
    }),
  };

  return NextResponse.json(withStuck);
}

// 수업 삭제 — 딸린 인스턴스(대화·진행상태 자동)·등록을 먼저 지우고 수업 삭제.
// 단계·정답지 연결은 onDelete Cascade로 자동 삭제됨. 지식파일 원본은 라이브러리에 남김(다른 수업 공유 가능).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const { id } = await params;

  // 내 수업인지 확인
  const course = await prisma.course.findUnique({
    where: { id, teacherId: session.user.id },
    select: { id: true },
  });
  if (!course) {
    return NextResponse.json({ error: "수업을 찾을 수 없습니다" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.aIInstance.deleteMany({ where: { courseId: id } }), // 메시지·진행상태는 Cascade
    prisma.courseEnrollment.deleteMany({ where: { courseId: id } }),
    prisma.course.delete({ where: { id } }), // 단계·정답지 연결은 Cascade
  ]);

  return NextResponse.json({ success: true });
}

// 수업 설정 수정 — 이름·설명·과목·단원·학년·AI학생 설정·지식범위
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id, teacherId: session.user.id },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "수업을 찾을 수 없습니다" }, { status: 404 });

  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (typeof b.description === "string") data.description = b.description.trim() || null;
  if (typeof b.subject === "string" && b.subject.trim()) data.subject = b.subject.trim();
  if (typeof b.unit === "string" && b.unit.trim()) data.unit = b.unit.trim();
  if (typeof b.gradeLevel === "string" && b.gradeLevel.trim()) data.gradeLevel = b.gradeLevel.trim();
  if (typeof b.aiName === "string" && b.aiName.trim()) data.aiName = b.aiName.trim();
  if (["low", "medium", "high"].includes(b.comprehensionLevel)) data.comprehensionLevel = b.comprehensionLevel;
  if (["passive", "curious", "challenging"].includes(b.personality)) data.personality = b.personality;
  if (Array.isArray(b.knownTopics)) data.knownTopics = JSON.stringify(b.knownTopics);
  if (Array.isArray(b.unknownTopics)) data.unknownTopics = JSON.stringify(b.unknownTopics);
  if (Array.isArray(b.misconceptions)) data.misconceptions = JSON.stringify(b.misconceptions);

  const updated = await prisma.course.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id });
}
