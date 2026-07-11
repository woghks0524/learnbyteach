"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Course {
  id: string;
  name: string;
  subject: string;
  unit: string;
  gradeLevel: string;
  description: string | null;
  _count: { enrollments: number; instances: number };
}

export default function TeacherDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session.user.role !== "teacher") router.push("/student");
  }, [status, session, router]);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/courses")
        .then((r) => r.json())
        .then((d) => setCourses(Array.isArray(d) ? d : []))
        .catch(() => setCourses([]))
        .finally(() => setLoaded(true));
    }
  }, [status]);

  const deleteCourse = async (e: React.MouseEvent, c: Course) => {
    e.preventDefault();
    e.stopPropagation();
    const hasData = c._count.instances > 0 || c._count.enrollments > 0;
    const msg = hasData
      ? `"${c.name}" 수업을 삭제할까요?\n등록 학생 ${c._count.enrollments}명, 진행 중인 대화 ${c._count.instances}명의 기록이 모두 사라지고 되돌릴 수 없어요.`
      : `"${c.name}" 수업을 삭제할까요? 되돌릴 수 없어요.`;
    if (!window.confirm(msg)) return;
    setDeletingId(c.id);
    try {
      const res = await fetch(`/api/courses/${c.id}`, { method: "DELETE" });
      if (res.ok) {
        setCourses((prev) => prev.filter((x) => x.id !== c.id));
      } else {
        alert("삭제에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      alert("삭제 중 오류가 발생했어요.");
    } finally {
      setDeletingId(null);
    }
  };

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">교사 대시보드</h1>
          <p className="text-gray-500">{session.user.name} 선생님</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/teacher/knowledge"
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            지식파일
          </Link>
          <Link
            href="/teacher/students"
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            학생 관리
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">내 수업</h2>
        <Link
          href="/teacher/courses/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
        >
          + 수업 개설
        </Link>
      </div>

      {!loaded ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 h-24 animate-pulse" />
          <div className="bg-white rounded-xl p-4 h-24 animate-pulse" />
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500">
          아직 개설한 수업이 없습니다
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/teacher/courses/${c.id}`}
              className="block bg-white rounded-xl p-4 hover:shadow-md transition h-full"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-sm text-gray-500">
                    {c.subject} | {c.unit} | {c.gradeLevel}
                  </p>
                  {c.description && (
                    <p className="text-sm text-gray-400 mt-1">{c.description}</p>
                  )}
                </div>
                <div className="flex items-start gap-2 shrink-0">
                  <div className="text-right text-xs space-y-1">
                    <span className="bg-gray-100 px-2 py-1 rounded-full block">
                      등록 {c._count.enrollments}명
                    </span>
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full block">
                      참여 {c._count.instances}명
                    </span>
                  </div>
                  <button
                    onClick={(e) => deleteCourse(e, c)}
                    disabled={deletingId === c.id}
                    title="수업 삭제"
                    className="text-gray-300 hover:text-red-500 disabled:opacity-40 px-1 py-0.5 text-lg leading-none"
                  >
                    {deletingId === c.id ? "…" : "🗑"}
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
