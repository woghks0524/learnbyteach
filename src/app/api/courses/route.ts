import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurriculumUnit } from "@/lib/curriculum";

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

  // 교육과정 단원을 골랐으면, 그 단원의 학습내용을 정답지(지식파일)로 자동 생성해 연결한다.
  const knowledgeFileIds: string[] = [...(body.knowledgeFileIds || [])];
  if (body.curriculumUnitId != null) {
    const u = getCurriculumUnit(Number(body.curriculumUnitId));
    if (u) {
      const answerKey = [
        `[${u.grade}학년 ${u.semester}학기 ${u.subject} · ${u.unit} (${u.publisher})]`,
        u.standards ? `성취기준: ${u.standards}` : "",
        `단원 학습내용:\n${u.content}`,
      ].filter(Boolean).join("\n\n");
      const kf = await prisma.knowledgeFile.create({
        data: {
          teacherId: session.user.id,
          fileName: `${u.unit} (${u.publisher}) · 교육과정`,
          content: answerKey,
          fileType: "curriculum",
          subject: u.subject,
        },
      });
      knowledgeFileIds.push(kf.id);
    }
  }

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
        create: knowledgeFileIds.map((fileId: string) => ({
          knowledgeFileId: fileId,
        })),
      },
    },
  });

  return NextResponse.json(course);
}
