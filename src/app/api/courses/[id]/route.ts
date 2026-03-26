import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const { id } = await params;

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
