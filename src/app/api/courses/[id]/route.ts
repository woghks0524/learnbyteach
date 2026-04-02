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
        },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "수업을 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json(course);
}
