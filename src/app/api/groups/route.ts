import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 내 그룹(반) 목록 — 멤버 포함
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const groups = await prisma.studentGroup.findMany({
    where: { teacherId: session.user.id },
    include: {
      members: {
        include: { student: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      students: g.members.map((m) => m.student),
    }))
  );
}

// 그룹 생성 { name, studentIds }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const { name, studentIds } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "그룹 이름을 입력해주세요" }, { status: 400 });
  }

  const ids: string[] = Array.isArray(studentIds) ? [...new Set(studentIds)] : [];

  const group = await prisma.studentGroup.create({
    data: {
      teacherId: session.user.id,
      name: name.trim(),
      members: { create: ids.map((studentId: string) => ({ studentId })) },
    },
  });

  return NextResponse.json({ id: group.id });
}
