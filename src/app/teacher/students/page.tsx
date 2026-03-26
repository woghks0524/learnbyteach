"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentManagementPage() {
  const router = useRouter();
  const [students, setStudents] = useState([{ name: "", email: "", password: "" }]);
  const [results, setResults] = useState<{ email: string; success: boolean; error?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const addRow = () => setStudents((prev) => [...prev, { name: "", email: "", password: "" }]);

  const updateRow = (index: number, field: string, value: string) => {
    setStudents((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const removeRow = (index: number) => {
    if (students.length <= 1) return;
    setStudents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResults([]);

    const valid = students.filter((s) => s.name && s.email && s.password);
    if (valid.length === 0) {
      setLoading(false);
      return;
    }

    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students: valid }),
    });

    const data = await res.json();
    setResults(data);
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button onClick={() => router.push("/teacher")} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; 대시보드로
      </button>
      <h1 className="text-2xl font-bold mb-6">학생 계정 관리</h1>

      {results.length > 0 && (
        <div className="mb-6 bg-white rounded-xl p-4 space-y-2">
          <h3 className="font-semibold">생성 결과</h3>
          {results.map((r, i) => (
            <div key={i} className={`text-sm px-3 py-2 rounded-lg ${
              r.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}>
              {r.email}: {r.success ? "생성 완료" : r.error}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-4">학생 계정 일괄 생성</h2>

        <div className="space-y-3">
          {students.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                value={s.name}
                onChange={(e) => updateRow(i, "name", e.target.value)}
                placeholder="이름"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={s.email}
                onChange={(e) => updateRow(i, "email", e.target.value)}
                placeholder="이메일"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={s.password}
                onChange={(e) => updateRow(i, "password", e.target.value)}
                placeholder="비밀번호"
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-gray-400 hover:text-red-500 px-2"
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="mt-3 text-sm text-blue-600 hover:text-blue-700"
        >
          + 행 추가
        </button>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
          >
            {loading ? "생성 중..." : "계정 생성"}
          </button>
        </div>
      </form>
    </div>
  );
}
