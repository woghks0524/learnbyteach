import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 학생 검색 (교사용)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const query = req.nextUrl.searchParams.get("q") || "";

  if (query.length < 1) {
    return NextResponse.json([]);
  }

  const students = await prisma.user.findMany({
    where: {
      role: "student",
      OR: [
        { name: { contains: query } },
        { email: { contains: query } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 20,
  });

  return NextResponse.json(students);
}

// 학생 계정 생성 (교사용)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const { students } = await req.json();
  // students: [{ name, email, password }]

  const results = [];
  for (const s of students) {
    if (!s.name || !s.email || !s.password) {
      results.push({ email: s.email, success: false, error: "필수 정보 누락" });
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email: s.email } });
    if (existing) {
      results.push({ email: s.email, success: false, error: "이미 존재하는 이메일" });
      continue;
    }

    const hashedPassword = await bcrypt.hash(s.password, 10);
    const user = await prisma.user.create({
      data: {
        name: s.name,
        email: s.email,
        password: hashedPassword,
        role: "student",
        createdById: session.user.id,
      },
    });
    results.push({ email: s.email, success: true, id: user.id, name: user.name });
  }

  return NextResponse.json(results);
}
