"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EMAIL_DOMAIN, toEmail } from "@/lib/constants";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = await signIn("credentials", {
      email: toEmail(username),
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-sky-100 via-sky-50 to-indigo-100">
      <div className="w-full max-w-sm">
        {/* AI 친구들 인사 */}
        <div className="flex justify-center items-end -space-x-4 mb-4">
          <img src="/avatars/curious.png" alt="" className="w-16 h-16 rounded-full object-cover ring-4 ring-white shadow-md -rotate-12" />
          <img src="/avatars/default.png" alt="" className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-lg z-10" />
          <img src="/avatars/shy.png" alt="" className="w-16 h-16 rounded-full object-cover ring-4 ring-white shadow-md rotate-12" />
        </div>
        <h1 className="text-3xl font-extrabold text-center mb-1 text-gray-800">가르치며 배우기</h1>
        <p className="text-center text-base text-gray-500 mb-6">AI 친구를 가르치면 내가 진짜 똑똑해져요! ✨</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-lg p-6 space-y-4">
          {error && (
            <p className="text-red-500 text-base bg-red-50 p-3 rounded-2xl text-center">🙈 {error}</p>
          )}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-1">아이디</label>
            <div className="flex items-center border-2 border-sky-200 rounded-2xl focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디"
                className="flex-1 min-w-0 px-4 py-3 text-base bg-transparent rounded-l-2xl focus:outline-none"
                required
              />
              <span className="px-3 text-sm text-gray-400 select-none whitespace-nowrap">@{EMAIL_DOMAIN}</span>
            </div>
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-base border-2 border-sky-200 rounded-2xl focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-3.5 text-lg bg-gradient-to-r from-sky-400 to-indigo-400 text-white rounded-full hover:from-sky-500 hover:to-indigo-500 transition font-bold shadow-md active:scale-[0.98]"
          >
            들어가기 🚀
          </button>
          <p className="text-center text-base text-gray-500">
            계정이 없으신가요?{" "}
            <Link href="/register" className="text-sky-600 font-bold hover:underline">
              회원가입
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
