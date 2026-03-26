import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const { id: courseId } = await params;
  const { studentIds } = await req.json();

  const results = [];
  for (const studentId of studentIds) {
    try {
      const enrollment = await prisma.courseEnrollment.create({
        data: { studentId, courseId },
      });
      results.push({ studentId, success: true, enrollment });
    } catch {
      results.push({ studentId, success: false, error: "이미 등록되었거나 오류 발생" });
    }
  }

  return NextResponse.json(results);
}
