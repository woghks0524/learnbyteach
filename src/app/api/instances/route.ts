import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "학생만 사용할 수 있습니다" }, { status: 403 });
  }

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { studentId: session.user.id },
    include: {
      course: { include: { teacher: { select: { name: true } } } },
    },
  });

  const result = await Promise.all(
    enrollments.map(async (e) => {
      const instance = await prisma.aIInstance.findUnique({
        where: {
          courseId_studentId: {
            courseId: e.courseId,
            studentId: session.user.id,
          },
        },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      });

      const messageCount = instance
        ? await prisma.message.count({ where: { instanceId: instance.id } })
        : 0;

      return {
        courseId: e.course.id,
        instanceId: instance?.id || null,
        courseName: e.course.name,
        subject: e.course.subject,
        unit: e.course.unit,
        gradeLevel: e.course.gradeLevel,
        teacherName: e.course.teacher.name,
        messageCount,
        lastMessage: instance?.messages[0]?.content || null,
      };
    })
  );

  return NextResponse.json(result);
}
