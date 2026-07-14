"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface Student {
  id: string;
  name: string;
  email: string;
}

interface Instance {
  id: string;
  student: Student;
  comprehensionState: string;
  messages: { role: string; content: string; createdAt: string }[];
  stuck?: boolean;
  currentStepTitle?: string | null;
}

interface LessonStep {
  id: string;
  order: number;
  title: string;
  description: string | null;
  aiName: string;
  aiAvatar: string;
  aiPersonality: string;
  aiFocus: string | null;
  completionCriteria: string | null;
  minMessages: number;
}

interface CourseDetail {
  id: string;
  name: string;
  subject: string;
  unit: string;
  gradeLevel: string;
  description: string | null;
  comprehensionLevel: string;
  personality: string;
  knownTopics: string;
  unknownTopics: string;
  misconceptions: string;
  enrollments: { student: Student }[];
  instances: Instance[];
}

const parseArr = (s: string): string[] => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } };

const BLANK_STEP: Omit<LessonStep, "id" | "order"> = {
  title: "",
  description: "",
  aiName: "AI 학생",
  aiAvatar: "default",
  aiPersonality: "curious",
  aiFocus: "",
  completionCriteria: "",
  minMessages: 6,
};

export default function CourseDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"students" | "conversations" | "steps" | "settings">("students");

  // 수업 설정 편집
  const [settings, setSettings] = useState({ name: "", description: "", subject: "", unit: "", gradeLevel: "", aiName: "AI 친구", comprehensionLevel: "medium", personality: "curious", knownTopics: "", unknownTopics: "", misconceptions: "" });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);

  // 그룹으로 학생 추가
  const [groups, setGroups] = useState<{ id: string; name: string; students: Student[] }[]>([]);
  useEffect(() => { fetch("/api/groups").then((r) => r.json()).then((d) => Array.isArray(d) && setGroups(d)); }, []);
  const enrollGroup = async (studentIds: string[]) => {
    if (studentIds.length === 0) return;
    await fetch(`/api/courses/${id}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds }),
    });
    loadCourse();
  };

  // 단계 설계
  const [steps, setSteps] = useState<LessonStep[]>([]);
  const [editingStep, setEditingStep] = useState<LessonStep | null>(null);
  const [isNewStep, setIsNewStep] = useState(false);
  const [stepSaving, setStepSaving] = useState(false);

  const loadCourse = useCallback(() => {
    fetch(`/api/courses/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCourse(data);
        setSettings({
          name: data.name ?? "",
          description: data.description ?? "",
          subject: data.subject ?? "",
          unit: data.unit ?? "",
          gradeLevel: data.gradeLevel ?? "",
          aiName: data.aiName ?? "AI 친구",
          comprehensionLevel: data.comprehensionLevel ?? "medium",
          personality: data.personality ?? "curious",
          knownTopics: parseArr(data.knownTopics ?? "[]").join(", "),
          unknownTopics: parseArr(data.unknownTopics ?? "[]").join(", "),
          misconceptions: parseArr(data.misconceptions ?? "[]").join("\n"),
        });
        setLoading(false);
      });
  }, [id]);

  const saveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMsg("");
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settings.name,
          description: settings.description,
          subject: settings.subject,
          unit: settings.unit,
          gradeLevel: settings.gradeLevel,
          aiName: settings.aiName,
          comprehensionLevel: settings.comprehensionLevel,
          personality: settings.personality,
          knownTopics: settings.knownTopics.split(",").map((s) => s.trim()).filter(Boolean),
          unknownTopics: settings.unknownTopics.split(",").map((s) => s.trim()).filter(Boolean),
          misconceptions: settings.misconceptions.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (res.ok) { setSettingsMsg("저장됐어요 ✅"); loadCourse(); }
      else setSettingsMsg("저장에 실패했어요.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const loadSteps = useCallback(() => {
    fetch(`/api/courses/${id}/steps`)
      .then((r) => r.json())
      .then(setSteps);
  }, [id]);

  useEffect(() => {
    loadCourse();
    loadSteps();
  }, [loadCourse, loadSteps]);

  useEffect(() => {
    if (searchQuery.length < 1) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/students?q=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then(setSearchResults);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const enrollStudents = async () => {
    if (selectedStudents.length === 0) return;
    await fetch(`/api/courses/${id}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: selectedStudents.map((s) => s.id) }),
    });
    setSelectedStudents([]);
    setSearchQuery("");
    loadCourse();
  };

  const toggleStudent = (student: Student) => {
    setSelectedStudents((prev) =>
      prev.find((s) => s.id === student.id) ? prev.filter((s) => s.id !== student.id) : [...prev, student]
    );
  };

  const saveStep = async () => {
    if (!editingStep || !editingStep.title.trim()) return;
    setStepSaving(true);
    try {
      if (isNewStep) {
        await fetch(`/api/courses/${id}/steps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingStep),
        });
      } else {
        await fetch(`/api/courses/${id}/steps/${editingStep.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingStep),
        });
      }
      loadSteps();
      setEditingStep(null);
      setIsNewStep(false);
    } finally {
      setStepSaving(false);
    }
  };

  const deleteStep = async (stepId: string) => {
    if (!confirm("이 단계를 삭제할까요?")) return;
    await fetch(`/api/courses/${id}/steps/${stepId}`, { method: "DELETE" });
    loadSteps();
    if (editingStep?.id === stepId) setEditingStep(null);
  };

  if (loading || !course) {
    return <div className="max-w-4xl mx-auto p-6"><p className="text-gray-500">로딩 중...</p></div>;
  }

  const enrolledIds = new Set(course.enrollments.map((e) => e.student.id));

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={() => router.push("/teacher")} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; 대시보드로
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{course.name}</h1>
        <p className="text-gray-500">{course.subject} | {course.unit} | {course.gradeLevel}</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        <button
          onClick={() => setActiveTab("students")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${activeTab === "students" ? "bg-white shadow" : "text-gray-600"}`}
        >
          학생 관리 ({course.enrollments.length}명)
        </button>
        <button
          onClick={() => setActiveTab("steps")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${activeTab === "steps" ? "bg-white shadow" : "text-gray-600"}`}
        >
          수업 설계 ({steps.length}단계)
        </button>
        <button
          onClick={() => setActiveTab("conversations")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${activeTab === "conversations" ? "bg-white shadow" : "text-gray-600"}`}
        >
          대화 열람 ({course.instances.length}명)
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${activeTab === "settings" ? "bg-white shadow" : "text-gray-600"}`}
        >
          설정
        </button>
      </div>

      {/* 학생 관리 탭 */}
      {activeTab === "students" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4">
            <h3 className="font-semibold mb-3">학생 추가</h3>

            {groups.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">그룹(반)으로 한 번에 추가:</p>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => {
                    const newOnes = g.students.filter((s) => !enrolledIds.has(s.id));
                    const done = newOnes.length === 0 && g.students.length > 0;
                    return (
                      <button
                        key={g.id}
                        onClick={() => enrollGroup(newOnes.map((s) => s.id))}
                        disabled={done || g.students.length === 0}
                        className={`px-3 py-1.5 rounded-full text-sm border transition ${done ? "bg-green-50 text-green-600 border-green-200 cursor-default" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}
                        title={done ? "이미 다 등록됨" : `${newOnes.length}명 추가`}
                      >
                        {g.name} · {g.students.length}명{done ? " ✓" : newOnes.length < g.students.length ? ` (+${newOnes.length})` : ""}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t mt-3 pt-3" />
              </div>
            )}

            <p className="text-sm text-gray-500 mb-2">또는 개별 검색으로 추가:</p>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="이름 또는 이메일로 검색..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.filter((s) => !enrolledIds.has(s.id)).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleStudent(s)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between items-center ${selectedStudents.find((sel) => sel.id === s.id) ? "bg-blue-50" : ""}`}
                    >
                      <div>
                        <span className="font-medium">{s.name}</span>
                        <span className="text-sm text-gray-500 ml-2">{s.email}</span>
                      </div>
                      {selectedStudents.find((sel) => sel.id === s.id) && <span className="text-blue-600 text-sm">선택됨</span>}
                    </button>
                  ))}
                  {searchResults.filter((s) => !enrolledIds.has(s.id)).length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-500">추가할 학생이 없습니다</p>
                  )}
                </div>
              )}
            </div>
            {selectedStudents.length > 0 && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedStudents.map((s) => (
                    <span key={s.id} className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full flex items-center gap-1">
                      {s.name}
                      <button onClick={() => toggleStudent(s)} className="hover:text-blue-600">&times;</button>
                    </span>
                  ))}
                </div>
                <button onClick={enrollStudents} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
                  {selectedStudents.length}명 등록
                </button>
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl p-4">
            <h3 className="font-semibold mb-3">등록된 학생</h3>
            {course.enrollments.length === 0 ? (
              <p className="text-sm text-gray-500">등록된 학생이 없습니다</p>
            ) : (
              <div className="space-y-2">
                {course.enrollments.map((e) => {
                  const inst = course.instances.find((i) => i.student.id === e.student.id);
                  return (
                    <div key={e.student.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{e.student.name}</span>
                          <span className="text-sm text-gray-500">{e.student.email}</span>
                        </div>
                        {inst?.currentStepTitle && (
                          <p className="text-xs text-gray-500 mt-0.5">진행 중: {inst.currentStepTitle}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {inst?.stuck && (
                          <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700" title="이 학생이 현재 단계에서 충분히 설명하지 못해 막혀 있어요">
                            🚧 막힘
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full ${inst ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {inst ? `대화 ${inst.messages.length}개` : "미참여"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 수업 설계 탭 */}
      {activeTab === "steps" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 단계 목록 */}
          <div className="space-y-2">
            {steps.length === 0 && !editingStep && (
              <div className="bg-white rounded-xl p-6 text-center text-gray-500 text-sm">
                아직 설계된 단계가 없어요.<br />단계를 추가해서 수업 흐름을 만들어보세요.
              </div>
            )}
            {steps.map((step) => {
              return (
                <div
                  key={step.id}
                  className={`bg-white rounded-xl p-4 cursor-pointer border-2 transition ${editingStep?.id === step.id ? "border-blue-400" : "border-transparent hover:border-gray-200"}`}
                  onClick={() => { setEditingStep({ ...step }); setIsNewStep(false); }}
                >
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 mt-0.5 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">{step.order}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium block truncate">{step.title}</span>
                      {step.completionCriteria && (
                        <span className="text-xs text-gray-400 line-clamp-2 mt-0.5">완료 기준: {step.completionCriteria}</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteStep(step.id); }}
                      className="text-gray-300 hover:text-red-400 px-1 shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => {
                setEditingStep({ ...BLANK_STEP, id: "", order: steps.length + 1 });
                setIsNewStep(true);
              }}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-500 transition text-sm"
            >
              + 단계 추가
            </button>
          </div>

          {/* 단계 편집 패널 */}
          {editingStep ? (
            <div className="bg-white rounded-xl p-4 space-y-4">
              <h3 className="font-semibold">{isNewStep ? "새 단계" : `단계 ${editingStep.order} 수정`}</h3>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">단계 이름</label>
                <input
                  type="text"
                  value={editingStep.title}
                  onChange={(e) => setEditingStep({ ...editingStep, title: e.target.value })}
                  placeholder="예: 사실 탐색, 원리 이해, 오개념 도전"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5 leading-relaxed">
                🧒 AI 학생(이름·성격·얼굴)은 수업 전체에 <b>한 명</b>이에요 — <b>설정 탭</b>에서 한 번만 정하면 모든 단계에 똑같이 적용돼요. 여기선 <b>단계별 학습 내용</b>만 정하면 돼요.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  이 단계의 집중 포인트 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <textarea
                  value={editingStep.aiFocus ?? ""}
                  onChange={(e) => setEditingStep({ ...editingStep, aiFocus: e.target.value })}
                  placeholder={"예: 광합성의 '왜'를 학생이 설명하도록 유도. 엽록체와 포도당의 연결 관계에 집중."}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  단계 완료 기준 <span className="text-gray-400 font-normal">(AI가 학생 설명이 이 수준에 도달했는지 스스로 판단)</span>
                </label>
                <textarea
                  value={editingStep.completionCriteria ?? ""}
                  onChange={(e) => setEditingStep({ ...editingStep, completionCriteria: e.target.value })}
                  placeholder={"예: 광합성에서 빛에너지가 포도당의 화학에너지로 변환된다는 과정을 학생이 자기 말로 설명해냄"}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  최소 대화 수 <span className="text-gray-400 font-normal">(이 수 초과해도 완료 안 되면 '막힌 학생' 표시)</span>
                </label>
                <input
                  type="number"
                  value={editingStep.minMessages}
                  onChange={(e) => setEditingStep({ ...editingStep, minMessages: Number(e.target.value) })}
                  min={2}
                  max={30}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setEditingStep(null); setIsNewStep(false); }} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  취소
                </button>
                <button
                  onClick={saveStep}
                  disabled={stepSaving || !editingStep.title.trim()}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {stepSaving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 text-sm">
              단계를 클릭하면 수정할 수 있어요
            </div>
          )}
        </div>
      )}

      {/* 대화 열람 탭 */}
      {activeTab === "conversations" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className="space-y-2 md:max-h-[75vh] md:overflow-y-auto md:sticky md:top-4 pr-1">
            {course.instances.length === 0 ? (
              <div className="bg-white rounded-xl p-4 text-center text-sm text-gray-500">아직 참여한 학생이 없습니다</div>
            ) : (
              course.instances.map((inst) => (
                <button
                  key={inst.id}
                  onClick={() => setSelectedInstance(inst)}
                  className={`w-full text-left p-3 rounded-lg transition ${selectedInstance?.id === inst.id ? "bg-blue-50 border border-blue-200" : "bg-white hover:bg-gray-50"}`}
                >
                  <p className="font-medium">{inst.student.name}</p>
                  <p className="text-xs text-gray-500">대화 {inst.messages.length}개</p>
                </button>
              ))
            )}
          </div>
          <div className="col-span-2">
            {selectedInstance ? (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4">
                  <h3 className="font-semibold mb-3">AI 이해도 상태</h3>
                  {(() => {
                    const state = JSON.parse(selectedInstance.comprehensionState || "{}");
                    return Object.keys(state).length === 0 ? (
                      <p className="text-sm text-gray-500">아직 이해도 데이터가 없습니다</p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(state).map(([topic, status]) => (
                          <div key={topic} className="flex justify-between items-center text-sm">
                            <span>{topic}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              String(status) === "이해함" ? "bg-green-100 text-green-700"
                              : String(status) === "부분 이해" ? "bg-yellow-100 text-yellow-700"
                              : String(status).startsWith("오해중") ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                            }`}>
                              {String(status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div className="bg-white rounded-xl p-4">
                  <h3 className="font-semibold mb-3">대화 기록</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedInstance.messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${msg.role === "student" ? "bg-blue-100 text-blue-900" : "bg-gray-100 text-gray-800"}`}>
                          <p className="text-xs font-medium mb-1 opacity-60">
                            {msg.role === "student" ? "학생(선생님 역할)" : "AI(학생 역할)"}
                          </p>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">학생을 선택하세요</div>
            )}
          </div>
        </div>
      )}

      {/* 설정 탭 */}
      {activeTab === "settings" && (
        <div className="bg-white rounded-xl p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-3">수업 정보</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수업 이름</label>
                <input type="text" value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">과목</label><input type="text" value={settings.subject} onChange={(e) => setSettings({ ...settings, subject: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">단원</label><input type="text" value={settings.unit} onChange={(e) => setSettings({ ...settings, unit: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">학년</label><input type="text" value={settings.gradeLevel} onChange={(e) => setSettings({ ...settings, gradeLevel: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명 <span className="text-gray-400 font-normal">(선택)</span></label>
                <input type="text" value={settings.description} onChange={(e) => setSettings({ ...settings, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-3">AI 학생 설정</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">AI 학생 이름</label>
              <input type="text" value={settings.aiName} maxLength={20} onChange={(e) => setSettings({ ...settings, aiName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">수업 전체에 걸쳐 학생이 가르칠 한 명의 AI 친구예요. 얼굴은 성격에 따라 자동으로 정해져요.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이해력 수준</label>
                <select value={settings.comprehensionLevel} onChange={(e) => setSettings({ ...settings, comprehensionLevel: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="low">낮음 - 쉽게 설명해줘야 이해</option>
                  <option value="medium">보통 - 기본은 알아듣지만 심화는 어려움</option>
                  <option value="high">높음 - 잘 알아듣고 날카로운 질문</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">성격</label>
                <select value={settings.personality} onChange={(e) => setSettings({ ...settings, personality: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="passive">수동적 - 주로 듣고 가끔 질문</option>
                  <option value="curious">호기심 - 왜? 어떻게? 질문 많음</option>
                  <option value="challenging">도전적 - 반박하고 논리 빈틈 찾음</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-3">지식 범위</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">선수학습 — 이전 학년에 배운 개념 (쉼표로 구분)</label>
                <input type="text" value={settings.knownTopics} onChange={(e) => setSettings({ ...settings, knownTopics: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">아직 모르는 개념 (쉼표로 구분)</label>
                <input type="text" value={settings.unknownTopics} onChange={(e) => setSettings({ ...settings, unknownTopics: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">흔한 오개념 (줄바꿈으로 구분)</label>
                <textarea value={settings.misconceptions} onChange={(e) => setSettings({ ...settings, misconceptions: e.target.value })} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={saveSettings} disabled={settingsSaving} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
              {settingsSaving ? "저장 중..." : "설정 저장"}
            </button>
            {settingsMsg && <span className="text-sm text-gray-600">{settingsMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
