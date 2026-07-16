"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 루트는 별도 랜딩 없이 곧바로 알맞은 화면으로 보낸다.
// (로그인 안 했으면 로그인, 했으면 역할에 맞는 대시보드)
export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated") {
      router.replace(session.user.role === "teacher" ? "/teacher" : "/student");
    } else {
      router.replace("/login");
    }
  }, [status, session, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-pink-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-pink-500" />
    </div>
  );
}
