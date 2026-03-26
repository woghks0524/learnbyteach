"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface KnowledgeFile {
  id: string;
  fileName: string;
  fileType: string;
  subject: string;
}

export default function NewCoursePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    subject: "",
    unit: "",
    gradeLevel: "",
    description: "",
    comprehensionLevel: "medium",
    personality: "curious",
    knownTopics: "",
    unknownTopics: "",
    misconceptions: "",
  });
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/knowledge").then((r) => r.json()).then(setKnowledgeFiles);
  }, []);

  // 과목 입력하면 관련 파일 필터링
  const filteredFiles = form.subject
    ? knowledgeFiles.filter((f) => !f.subject || f.subject.includes(form.subject))
    : knowledgeFiles;

  const toggleFile = (id: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        knownTopics: form.knownTopics.split(",").map((s) => s.trim()).filter(Boolean),
        unknownTopics: form.unknownTopics.split(",").map((s) => s.trim()).filter(Boolean),
        misconceptions: form.misconceptions.split("\n").map((s) => s.trim()).filter(Boolean),
        knowledgeFileIds: selectedFileIds,
      }),
    });

    if (res.ok) router.push("/teacher");
  };

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const fileTypeLabel: Record<string, string> = {
    curriculum: "교육과정",
    textbook: "교과서",
    custom: "기타",
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button onClick={() => router.push("/teacher")} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; 대시보드로
      </button>
      <h1 className="text-2xl font-bold mb-6">수업 개설</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-5">
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">수업 정보</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">수업 이름</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="예: 중2 과학 3반 - 물질의 구성"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">과목</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => update("subject", e.target.value)}
                placeholder="과학"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">단원/차시</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => update("unit", e.target.value)}
                placeholder="1단원 물질의 구성"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
              <input
                type="text"
                value={form.gradeLevel}
                onChange={(e) => update("gradeLevel", e.target.value)}
                placeholder="중학교 2학년"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="수업에 대한 간단한 설명"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 지식파일 선택 */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="font-semibold text-gray-800">지식파일 선택</h2>
            <button
              type="button"
              onClick={() => window.open("/teacher/knowledge", "_blank")}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              라이브러리 관리 &rarr;
            </button>
          </div>
          <p className="text-sm text-gray-500">
            AI 학생이 참고할 교육과정/교과서 파일을 선택하세요. 선택된 파일에 있는 내용만 AI가 인식합니다.
          </p>
          {knowledgeFiles.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-500">
              아직 업로드된 지식파일이 없습니다.{" "}
              <button
                type="button"
                onClick={() => router.push("/teacher/knowledge")}
                className="text-blue-600 hover:underline"
              >
                먼저 파일을 추가해주세요
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredFiles.map((f) => (
                <label
                  key={f.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${
                    selectedFileIds.includes(f.id) ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFileIds.includes(f.id)}
                    onChange={() => toggleFile(f.id)}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.fileName}</p>
                    <div className="flex gap-1">
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{fileTypeLabel[f.fileType] || f.fileType}</span>
                      {f.subject && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{f.subject}</span>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
          {selectedFileIds.length > 0 && (
            <p className="text-xs text-blue-600">{selectedFileIds.length}개 파일 선택됨</p>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">AI 학생 설정</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이해력 수준</label>
              <select
                value={form.comprehensionLevel}
                onChange={(e) => update("comprehensionLevel", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">낮음 - 쉽게 설명해줘야 이해</option>
                <option value="medium">보통 - 기본은 알아듣지만 심화는 어려움</option>
                <option value="high">높음 - 잘 알아듣고 날카로운 질문</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">성격</label>
              <select
                value={form.personality}
                onChange={(e) => update("personality", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="passive">수동적 - 주로 듣고 가끔 질문</option>
                <option value="curious">호기심 - 왜? 어떻게? 질문 많음</option>
                <option value="challenging">도전적 - 반박하고 논리 빈틈 찾음</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">지식 범위</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이미 아는 개념 (쉼표로 구분)</label>
            <input
              type="text"
              value={form.knownTopics}
              onChange={(e) => update("knownTopics", e.target.value)}
              placeholder="예: 원자, 분자, 원소"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">아직 모르는 개념 (쉼표로 구분)</label>
            <input
              type="text"
              value={form.unknownTopics}
              onChange={(e) => update("unknownTopics", e.target.value)}
              placeholder="예: 이온, 화학 결합, 전자 배치"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">흔한 오개념 (줄바꿈으로 구분)</label>
            <textarea
              value={form.misconceptions}
              onChange={(e) => update("misconceptions", e.target.value)}
              placeholder={"예:\n원자와 분자가 같은 것이라고 생각함\n모든 금속은 자석에 붙는다고 생각함"}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
            취소
          </button>
          <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
            개설하기
          </button>
        </div>
      </form>
    </div>
  );
}
