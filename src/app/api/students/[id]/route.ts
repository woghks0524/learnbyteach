import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 학생 계정 비밀번호 초기화 { password }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  const { id } = await params;
  // 내가 만든 학생만
  const student = await prisma.user.findUnique({
    where: { id, role: "student", createdById: session.user.id },
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "학생을 찾을 수 없습니다" }, { status: 404 });

  const { password } = await req.json();
  if (!password || String(password).length < 4) {
    return NextResponse.json({ error: "비밀번호는 4자 이상이어야 합니다" }, { status: 400 });
  }
  const hashed = await bcrypt.hash(String(password), 10);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
  return NextResponse.json({ success: true });
}

// 학생 계정 삭제 — 등록·인스턴스(대화 Cascade)·그룹 멤버까지 정리
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  const { id } = await params;
  const student = await prisma.user.findUnique({
    where: { id, role: "student", createdById: session.user.id },
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "학생을 찾을 수 없습니다" }, { status: 404 });

  await prisma.$transaction([
    prisma.aIInstance.deleteMany({ where: { studentId: id } }), // 메시지·진행상태 Cascade
    prisma.courseEnrollment.deleteMany({ where: { studentId: id } }),
    prisma.studentGroupMember.deleteMany({ where: { studentId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ success: true });
}
