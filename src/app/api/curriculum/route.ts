import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCurriculumIndex } from "@/lib/curriculum";

// 교사용: 교육과정 단원 인덱스(내용 제외) — 수업 개설 화면의 학년→학기→과목→출판사→단원 드롭다운용
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  return NextResponse.json(getCurriculumIndex(), {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
