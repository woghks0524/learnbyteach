"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface KnowledgeFile {
  id: string;
  fileName: string;
  fileType: string;
  subject: string;
  content: string;
  createdAt: string;
  _count: { courses: number };
}

export default function KnowledgeManagementPage() {
  const router = useRouter();
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "text">("file");
  const [form, setForm] = useState({ fileName: "", content: "", fileType: "curriculum", subject: "" });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<KnowledgeFile | null>(null);

  const loadFiles = () => {
    fetch("/api/knowledge").then((r) => r.json()).then(setFiles);
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileType", form.fileType);
    formData.append("subject", form.subject);

    await fetch("/api/knowledge", { method: "POST", body: formData });
    setUploading(false);
    setShowUpload(false);
    setForm({ fileName: "", content: "", fileType: "curriculum", subject: "" });
    loadFiles();
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setUploading(false);
    setShowUpload(false);
    setForm({ fileName: "", content: "", fileType: "curriculum", subject: "" });
    loadFiles();
  };

  const deleteFile = async (id: string) => {
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    setSelectedFile(null);
    loadFiles();
  };

  const fileTypeLabel: Record<string, string> = {
    curriculum: "교육과정",
    textbook: "교과서",
    custom: "기타 자료",
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={() => router.push("/teacher")} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; 대시보드로
      </button>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">지식파일 라이브러리</h1>
          <p className="text-sm text-gray-500">교육과정 문서, 교과서 내용 등을 관리하세요. 수업에서 선택하여 사용할 수 있습니다.</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
        >
          + 파일 추가
        </button>
      </div>

      {/* 업로드 모달 */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">지식파일 추가</h2>
              <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>

            {/* 탭 */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
              <button
                onClick={() => setUploadMode("file")}
                className={`flex-1 py-1.5 rounded-md text-sm ${uploadMode === "file" ? "bg-white shadow" : "text-gray-600"}`}
              >
                파일 업로드
              </button>
              <button
                onClick={() => setUploadMode("text")}
                className={`flex-1 py-1.5 rounded-md text-sm ${uploadMode === "text" ? "bg-white shadow" : "text-gray-600"}`}
              >
                직접 입력
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
                  <select
                    value={form.fileType}
                    onChange={(e) => setForm({ ...form, fileType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="curriculum">교육과정 문서</option>
                    <option value="textbook">교과서</option>
                    <option value="custom">기타 자료</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">과목 태그</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="예: 과학"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {uploadMode === "file" ? (
              <div>
                <label className="block w-full py-8 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-400 transition">
                  <span className="text-gray-500 text-sm">
                    {uploading ? "업로드 중..." : "클릭하여 파일 선택 (.txt, .md 등)"}
                  </span>
                  <input
                    type="file"
                    accept=".txt,.md,.csv,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            ) : (
              <form onSubmit={handleTextSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">파일명</label>
                  <input
                    type="text"
                    value={form.fileName}
                    onChange={(e) => setForm({ ...form, fileName: e.target.value })}
                    placeholder="예: 2022 개정 교육과정 - 과학 중2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="교육과정 내용, 성취기준, 단원 내용 등을 붙여넣기 하세요..."
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
                >
                  {uploading ? "저장 중..." : "저장"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 파일 목록 + 미리보기 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 space-y-2">
          {files.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-500">
              아직 업로드된 파일이 없습니다
            </div>
          ) : (
            files.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFile(f)}
                className={`w-full text-left p-3 rounded-lg transition ${
                  selectedFile?.id === f.id ? "bg-blue-50 border border-blue-200" : "bg-white hover:bg-gray-50"
                }`}
              >
                <p className="font-medium text-sm truncate">{f.fileName}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{fileTypeLabel[f.fileType] || f.fileType}</span>
                  {f.subject && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{f.subject}</span>}
                </div>
                <p className="text-xs text-gray-400 mt-1">수업 {f._count.courses}개에서 사용</p>
              </button>
            ))
          )}
        </div>

        <div className="col-span-2">
          {selectedFile ? (
            <div className="bg-white rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">{selectedFile.fileName}</h3>
                  <p className="text-xs text-gray-500">
                    {fileTypeLabel[selectedFile.fileType]} | {selectedFile.content.length.toLocaleString()}자
                  </p>
                </div>
                <button
                  onClick={() => deleteFile(selectedFile.id)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                >
                  삭제
                </button>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{selectedFile.content}</pre>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 text-center text-gray-500 text-sm">
              파일을 선택하면 내용을 미리볼 수 있습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
