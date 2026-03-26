import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  if (session.user.role === "teacher") {
    const courses = await prisma.course.findMany({
      where: { teacherId: session.user.id },
      include: {
        _count: { select: { enrollments: true, instances: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(courses);
  } else {
    const enrollments = await prisma.courseEnrollment.findMany({
      where: { studentId: session.user.id },
      include: {
        course: {
          include: { teacher: { select: { name: true } } },
        },
      },
    });
    return NextResponse.json(enrollments.map((e) => e.course));
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const body = await req.json();
  const course = await prisma.course.create({
    data: {
      teacherId: session.user.id,
      name: body.name,
      subject: body.subject,
      unit: body.unit,
      gradeLevel: body.gradeLevel,
      description: body.description || null,
      comprehensionLevel: body.comprehensionLevel || "medium",
      personality: body.personality || "curious",
      knownTopics: JSON.stringify(body.knownTopics || []),
      unknownTopics: JSON.stringify(body.unknownTopics || []),
      misconceptions: JSON.stringify(body.misconceptions || []),
      knowledgeFiles: {
        create: (body.knowledgeFileIds || []).map((fileId: string) => ({
          knowledgeFileId: fileId,
        })),
      },
    },
  });

  return NextResponse.json(course);
}
