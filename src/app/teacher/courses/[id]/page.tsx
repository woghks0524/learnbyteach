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
}

interface CourseDetail {
  id: string;
  name: string;
  subject: string;
  unit: string;
  gradeLevel: string;
  enrollments: { student: Student }[];
  instances: Instance[];
}

export default function CourseDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"students" | "conversations">("students");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCourse = useCallback(() => {
    fetch(`/api/courses/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCourse(data);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  // 학생 검색
  useEffect(() => {
    if (searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }
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
      prev.find((s) => s.id === student.id)
        ? prev.filter((s) => s.id !== student.id)
        : [...prev, student]
    );
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
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
            activeTab === "students" ? "bg-white shadow" : "text-gray-600"
          }`}
        >
          학생 관리 ({course.enrollments.length}명)
        </button>
        <button
          onClick={() => setActiveTab("conversations")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
            activeTab === "conversations" ? "bg-white shadow" : "text-gray-600"
          }`}
        >
          대화 열람 ({course.instances.length}명 참여)
        </button>
      </div>

      {activeTab === "students" && (
        <div className="space-y-4">
          {/* 학생 검색 */}
          <div className="bg-white rounded-xl p-4">
            <h3 className="font-semibold mb-3">학생 추가</h3>
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
                  {searchResults
                    .filter((s) => !enrolledIds.has(s.id))
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => toggleStudent(s)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between items-center ${
                          selectedStudents.find((sel) => sel.id === s.id) ? "bg-blue-50" : ""
                        }`}
                      >
                        <div>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-sm text-gray-500 ml-2">{s.email}</span>
                        </div>
                        {selectedStudents.find((sel) => sel.id === s.id) && (
                          <span className="text-blue-600 text-sm">선택됨</span>
                        )}
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
                <button
                  onClick={enrollStudents}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
                >
                  {selectedStudents.length}명 등록
                </button>
              </div>
            )}
          </div>

          {/* 등록된 학생 목록 */}
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
                      <div>
                        <span className="font-medium">{e.student.name}</span>
                        <span className="text-sm text-gray-500 ml-2">{e.student.email}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        inst ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {inst ? `대화 ${inst.messages.length}개` : "미참여"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "conversations" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            {course.instances.length === 0 ? (
              <div className="bg-white rounded-xl p-4 text-center text-sm text-gray-500">
                아직 참여한 학생이 없습니다
              </div>
            ) : (
              course.instances.map((inst) => (
                <button
                  key={inst.id}
                  onClick={() => setSelectedInstance(inst)}
                  className={`w-full text-left p-3 rounded-lg transition ${
                    selectedInstance?.id === inst.id
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-white hover:bg-gray-50"
                  }`}
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
                        <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                          msg.role === "student" ? "bg-blue-100 text-blue-900" : "bg-gray-100 text-gray-800"
                        }`}>
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
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                학생을 선택하세요
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
