"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface CourseInstance {
  courseId: string;
  instanceId: string | null;
  courseName: string;
  subject: string;
  unit: string;
  gradeLevel: string;
  teacherName: string;
  messageCount: number;
  lastMessage: string | null;
}

export default function StudentDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseInstance[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session.user.role !== "student") router.push("/teacher");
  }, [status, session, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/instances").then((r) => r.json()).then(setCourses);
    }
  }, [status]);

  if (status !== "authenticated") return null;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">내 수업</h1>
          <p className="text-gray-500">{session.user.name}님</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          로그아웃
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500">
          <p>아직 등록된 수업이 없습니다.</p>
          <p className="text-sm mt-2">선생님이 수업에 등록하면 여기에 나타납니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <Link
              key={c.courseId}
              href={`/student/chat/${c.courseId}`}
              className="block bg-white rounded-xl p-4 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{c.courseName}</h3>
                  <p className="text-sm text-gray-500">
                    {c.teacherName} 선생님 | {c.subject} | {c.unit}
                  </p>
                  {c.lastMessage && (
                    <p className="text-sm text-gray-400 mt-1 truncate max-w-xs">
                      마지막: {c.lastMessage}
                    </p>
                  )}
                </div>
                <div>
                  {c.messageCount > 0 ? (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      대화 {c.messageCount}개
                    </span>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      시작하기
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
