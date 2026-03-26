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

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/courses").then((r) => r.json()).then(setCourses);
    }
  }, [status]);

  if (status !== "authenticated") return null;

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

      {courses.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500">
          아직 개설한 수업이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/teacher/courses/${c.id}`}
              className="block bg-white rounded-xl p-4 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-sm text-gray-500">
                    {c.subject} | {c.unit} | {c.gradeLevel}
                  </p>
                  {c.description && (
                    <p className="text-sm text-gray-400 mt-1">{c.description}</p>
                  )}
                </div>
                <div className="text-right text-xs space-y-1">
                  <span className="bg-gray-100 px-2 py-1 rounded-full block">
                    등록 {c._count.enrollments}명
                  </span>
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full block">
                    참여 {c._count.instances}명
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
