import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 그룹 수정 { name?, studentIds? } — studentIds가 오면 멤버 전체 교체
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  const { id } = await params;
  const group = await prisma.studentGroup.findUnique({
    where: { id, teacherId: session.user.id },
    select: { id: true },
  });
  if (!group) return NextResponse.json({ error: "그룹을 찾을 수 없습니다" }, { status: 404 });

  const { name, studentIds } = await req.json();

  await prisma.$transaction(async (tx) => {
    if (typeof name === "string" && name.trim()) {
      await tx.studentGroup.update({ where: { id }, data: { name: name.trim() } });
    }
    if (Array.isArray(studentIds)) {
      const ids = [...new Set(studentIds)] as string[];
      await tx.studentGroupMember.deleteMany({ where: { groupId: id } });
      await tx.studentGroupMember.createMany({
        data: ids.map((studentId) => ({ groupId: id, studentId })),
        skipDuplicates: true,
      });
    }
  });

  return NextResponse.json({ success: true });
}

// 그룹 삭제 (멤버 연결은 Cascade, 학생 계정은 남음)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  const { id } = await params;
  const group = await prisma.studentGroup.findUnique({
    where: { id, teacherId: session.user.id },
    select: { id: true },
  });
  if (!group) return NextResponse.json({ error: "그룹을 찾을 수 없습니다" }, { status: 404 });

  await prisma.studentGroup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
