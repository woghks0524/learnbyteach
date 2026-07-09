"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface KnowledgeFile {
  id: string;
  fileName: string;
  fileType: string;
  subject: string;
}

interface CurriculumItem {
  id: number;
  grade: number;
  semester: number;
  subject: string;
  publisher: string;
  unit: string;
  domain: string;
}

const uniq = (arr: (string | number)[]) => [...new Set(arr)];

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 교육과정 단원 선택 (학년→학기→과목→출판사→단원)
  const [curriculum, setCurriculum] = useState<CurriculumItem[]>([]);
  const [cur, setCur] = useState({ grade: "", semester: "", subject: "", publisher: "", unitId: "" });

  useEffect(() => {
    fetch("/api/knowledge").then((r) => r.json()).then(setKnowledgeFiles);
    fetch("/api/curriculum").then((r) => r.json()).then((d) => Array.isArray(d) && setCurriculum(d));
  }, []);

  // 단계별 후보 목록 (앞 선택에 따라 좁혀짐)
  const g = cur.grade ? Number(cur.grade) : null;
  const s = cur.semester ? Number(cur.semester) : null;
  const curGrades = uniq(curriculum.map((c) => c.grade)).sort((a, b) => (a as number) - (b as number));
  const curSemesters = uniq(curriculum.filter((c) => c.grade === g).map((c) => c.semester)).sort();
  const curSubjects = uniq(curriculum.filter((c) => c.grade === g && c.semester === s).map((c) => c.subject));
  const curPublishers = uniq(
    curriculum.filter((c) => c.grade === g && c.semester === s && c.subject === cur.subject).map((c) => c.publisher)
  );
  const curUnits = curriculum.filter(
    (c) => c.grade === g && c.semester === s && c.subject === cur.subject && c.publisher === cur.publisher
  );

  // AI 자동 구성 결과(학습 단계)
  const [genSteps, setGenSteps] = useState<{ title: string; aiFocus: string; completionCriteria: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");

  // 단원을 고르면 과목·단원·학년을 자동 입력
  const selectUnit = (unitId: string) => {
    setCur((p) => ({ ...p, unitId }));
    setGenSteps([]);
    setGenMsg("");
    const item = curriculum.find((c) => c.id === Number(unitId));
    if (item) {
      setForm((f) => ({
        ...f,
        subject: item.subject,
        unit: item.unit,
        gradeLevel: `${item.grade}학년`,
        name: f.name || `${item.grade}학년 ${item.subject} - ${item.unit}`,
      }));
    }
  };

  // AI가 오개념·선수학습·학습단계를 자동으로 채운다
  const autoConfigure = async () => {
    if (!cur.unitId) return;
    setGenerating(true);
    setGenMsg("");
    setError("");
    try {
      const res = await fetch("/api/courses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculumUnitId: Number(cur.unitId), knowledgeFileIds: selectedFileIds }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setForm((f) => ({
        ...f,
        comprehensionLevel: d.comprehensionLevel || f.comprehensionLevel,
        personality: d.personality || f.personality,
        knownTopics: (d.knownTopics || []).join(", "),
        unknownTopics: (d.unknownTopics || []).join(", "),
        misconceptions: (d.misconceptions || []).join("\n"),
      }));
      setGenSteps(Array.isArray(d.steps) ? d.steps : []);
      setGenMsg(`✨ AI가 채웠어요 — 오개념 ${(d.misconceptions || []).length}개, 학습 단계 ${(d.steps || []).length}개. 아래에서 확인·수정하세요.`);
    } catch {
      setGenMsg("자동 구성에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setGenerating(false);
    }
  };

  const updateStep = (i: number, field: "title" | "aiFocus" | "completionCriteria", value: string) =>
    setGenSteps((prev) => prev.map((st, idx) => (idx === i ? { ...st, [field]: value } : st)));
  const removeStep = (i: number) => setGenSteps((prev) => prev.filter((_, idx) => idx !== i));

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
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          knownTopics: form.knownTopics.split(",").map((s) => s.trim()).filter(Boolean),
          unknownTopics: form.unknownTopics.split(",").map((s) => s.trim()).filter(Boolean),
          misconceptions: form.misconceptions.split("\n").map((s) => s.trim()).filter(Boolean),
          knowledgeFileIds: selectedFileIds,
          curriculumUnitId: cur.unitId ? Number(cur.unitId) : null,
          steps: genSteps.filter((st) => st.title.trim()),
        }),
      });

      if (res.ok) {
        router.push("/teacher");
      } else {
        const data = await res.json();
        setError(data.error || "수업 개설에 실패했습니다. 다시 시도해주세요.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
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

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

        {/* 교육과정에서 단원 불러오기 (기본 제공) */}
        <div className="space-y-3">
          <div className="border-b pb-2">
            <h2 className="font-semibold text-gray-800">📚 교육과정에서 단원 불러오기</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              학년·학기·과목·출판사·단원을 고르면 <b>과목·단원·학년과 정답지(AI가 참고할 단원 학습내용)가 자동으로 채워져요.</b> 따로 파일을 올릴 필요 없어요.
            </p>
          </div>
          {curriculum.length === 0 ? (
            <p className="text-sm text-gray-400">교육과정 데이터를 불러오는 중...</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <select
                value={cur.grade}
                onChange={(e) => setCur({ grade: e.target.value, semester: "", subject: "", publisher: "", unitId: "" })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">학년</option>
                {curGrades.map((v) => <option key={v} value={v}>{v}학년</option>)}
              </select>
              <select
                value={cur.semester}
                disabled={!cur.grade}
                onChange={(e) => setCur((p) => ({ ...p, semester: e.target.value, subject: "", publisher: "", unitId: "" }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">학기</option>
                {curSemesters.map((v) => <option key={v} value={v}>{v}학기</option>)}
              </select>
              <select
                value={cur.subject}
                disabled={!cur.semester}
                onChange={(e) => setCur((p) => ({ ...p, subject: e.target.value, publisher: "", unitId: "" }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">과목</option>
                {curSubjects.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select
                value={cur.publisher}
                disabled={!cur.subject}
                onChange={(e) => setCur((p) => ({ ...p, publisher: e.target.value, unitId: "" }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">출판사</option>
                {curPublishers.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select
                value={cur.unitId}
                disabled={!cur.publisher}
                onChange={(e) => selectUnit(e.target.value)}
                className="col-span-2 sm:col-span-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">단원</option>
                {curUnits.map((u) => <option key={u.id} value={u.id}>{u.unit}</option>)}
              </select>
            </div>
          )}
          {cur.unitId && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              ✅ 이 단원의 학습내용이 정답지로 등록됩니다. 아래 &apos;수업 정보&apos;가 자동으로 채워졌어요.
            </div>
          )}

          {/* AI 자동 구성 */}
          {cur.unitId && (
            <div className="rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={autoConfigure}
                  disabled={generating}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-60"
                >
                  {generating ? "AI가 구성하는 중..." : "🪄 AI로 수업 자동 구성"}
                </button>
                <span className="text-sm text-gray-600">
                  이 단원의 <b>흔한 오개념·선수학습·학습 단계(완료 기준)</b>를 AI가 초안으로 채워줘요.
                  {selectedFileIds.length > 0
                    ? " 선택한 지식파일도 함께 반영해요."
                    : " (아래에서 지식파일을 먼저 선택하면 그 자료도 함께 반영해요.)"}
                </span>
              </div>
              {genMsg && <p className="text-sm text-indigo-700 mt-2">{genMsg}</p>}
            </div>
          )}

          {/* 생성된 학습 단계 미리보기·편집 */}
          {genSteps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">학습 단계 <span className="font-normal text-gray-400">(AI 초안 — 수정 가능, 저장 시 함께 생성돼요)</span></h3>
              {genSteps.map((st, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <input
                      value={st.title}
                      onChange={(e) => updateStep(i, "title", e.target.value)}
                      placeholder="단계 이름"
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button type="button" onClick={() => removeStep(i)} className="text-gray-400 hover:text-red-500 px-1">&times;</button>
                  </div>
                  <input
                    value={st.aiFocus}
                    onChange={(e) => updateStep(i, "aiFocus", e.target.value)}
                    placeholder="이 단계에서 다룰 주제"
                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <textarea
                    value={st.completionCriteria}
                    onChange={(e) => updateStep(i, "completionCriteria", e.target.value)}
                    placeholder="완료 기준 — 학생이 무엇을 설명하면 이 단계가 끝나는지"
                    rows={2}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 지식파일 선택 (직접 올린 자료를 추가로 쓰고 싶을 때) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="font-semibold text-gray-800">지식파일 직접 선택 <span className="font-normal text-gray-400 text-sm">(선택)</span></h2>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">선수학습 — 이전 학년에 이미 배운 개념 (쉼표로 구분)</label>
            <input
              type="text"
              value={form.knownTopics}
              onChange={(e) => update("knownTopics", e.target.value)}
              placeholder="예: 동물의 한살이, 식물의 구조 (3학년까지 배운 것)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              AI 학생이 &quot;이미 아는 것&quot;의 경계예요. 여기 적은 것만 알고, 이번 단원 내용은 모르는 상태로 시작해요. 학년 수준에 맞는 질문을 하게 하려면 채워주세요.
            </p>
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
          <button type="submit" disabled={loading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50">
            {loading ? "개설 중..." : "개설하기"}
          </button>
        </div>
      </form>
    </div>
  );
}
