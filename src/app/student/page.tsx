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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session.user.role !== "student") router.push("/teacher");
  }, [status, session, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/instances")
        .then((r) => r.json())
        .then((d) => setCourses(Array.isArray(d) ? d : []))
        .catch(() => setCourses([]))
        .finally(() => setLoaded(true));
    }
  }, [status]);

  if (status !== "authenticated") return null;

  return (
    <div className="min-h-screen bg-sky-50">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">📚 내 수업</h1>
            <p className="text-lg text-gray-600 mt-1">{session.user.name} 선생님, 안녕하세요! 👋</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            로그아웃
          </button>
        </div>

        {!loaded ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 h-24 animate-pulse" />
            <div className="bg-white rounded-2xl p-5 h-24 animate-pulse" />
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-500 border-2 border-dashed border-sky-200">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-lg font-medium">아직 수업이 없어요</p>
            <p className="text-base mt-2">선생님이 수업에 등록해 주시면 여기에 나타나요!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((c) => (
              <Link
                key={c.courseId}
                href={`/student/chat/${c.courseId}`}
                className="block bg-white rounded-2xl p-5 border-2 border-transparent hover:border-sky-300 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold">{c.courseName}</h3>
                    <p className="text-base text-gray-500 mt-0.5">
                      {c.teacherName} 선생님 · {c.subject} · {c.unit}
                    </p>
                    {c.lastMessage && (
                      <p className="text-sm text-gray-400 mt-1.5 truncate max-w-xs">
                        💬 {c.lastMessage}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {c.messageCount > 0 ? (
                      <span className="text-sm font-medium bg-sky-100 text-sky-700 px-3 py-1.5 rounded-full">
                        이어서 하기 ✏️
                      </span>
                    ) : (
                      <span className="text-sm font-bold bg-green-100 text-green-700 px-3 py-1.5 rounded-full">
                        시작하기 🚀
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
