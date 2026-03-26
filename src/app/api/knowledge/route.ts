import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 교사의 지식파일 라이브러리 조회
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const subject = req.nextUrl.searchParams.get("subject");

  const files = await prisma.knowledgeFile.findMany({
    where: {
      teacherId: session.user.id,
      ...(subject ? { subject } : {}),
    },
    include: {
      _count: { select: { courses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(files);
}

// 지식파일 업로드 (텍스트 직접 입력 또는 파일 업로드)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    // 파일 업로드
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const fileType = (formData.get("fileType") as string) || "custom";
    const subject = (formData.get("subject") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    }

    const content = await file.text();

    const knowledgeFile = await prisma.knowledgeFile.create({
      data: {
        teacherId: session.user.id,
        fileName: file.name,
        content,
        fileType,
        subject,
      },
    });

    return NextResponse.json(knowledgeFile);
  } else {
    // JSON으로 직접 입력
    const { fileName, content, fileType, subject } = await req.json();

    if (!fileName || !content) {
      return NextResponse.json({ error: "파일명과 내용을 입력해주세요" }, { status: 400 });
    }

    const knowledgeFile = await prisma.knowledgeFile.create({
      data: {
        teacherId: session.user.id,
        fileName,
        content,
        fileType: fileType || "custom",
        subject: subject || "",
      },
    });

    return NextResponse.json(knowledgeFile);
  }
}
