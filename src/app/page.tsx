"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push(session.user.role === "teacher" ? "/teacher" : "/student");
    }
  }, [status, session, router]);

  // 로딩 중이거나, 이미 로그인돼서 곧 이동할 때는 랜딩 대신 로딩 화면만 (로그인/회원가입 버튼이 번쩍하는 것 방지)
  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">가르치며 배우기</h1>
        <p className="text-lg text-gray-600 max-w-md">
          AI 학생에게 설명하면서 진짜 이해하고 있는지 확인해보세요
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          로그인
        </Link>
        <Link
          href="/register"
          className="px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
        >
          회원가입
        </Link>
      </div>
    </div>
  );
}
