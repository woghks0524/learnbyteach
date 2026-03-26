import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 지식파일 상세 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const { id } = await params;
  const file = await prisma.knowledgeFile.findUnique({
    where: { id, teacherId: session.user.id },
    include: { courses: { include: { course: { select: { id: true, name: true } } } } },
  });

  if (!file) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json(file);
}

// 지식파일 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.knowledgeFile.delete({
    where: { id, teacherId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
