"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EMAIL_DOMAIN, toEmail } from "@/lib/constants";

export default function StudentManagementPage() {
  const router = useRouter();
  const [students, setStudents] = useState([{ name: "", username: "", password: "" }]);
  const [results, setResults] = useState<{ email: string; success: boolean; error?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // 엑셀 붙여넣기
  const [pasteText, setPasteText] = useState("");
  const [commonPw, setCommonPw] = useState("");
  const [importMsg, setImportMsg] = useState("");

  const [importing, setImporting] = useState(false);

  // 행 배열(각 행 = [이름, 아이디, 비밀번호?])을 학생 목록으로 채운다. 붙여넣기·엑셀 업로드 공통.
  const fillFromRows = (rows: string[][], source: "paste" | "file") => {
    // 머리글 행(이름/아이디/학번 등) 자동 건너뛰기
    const filtered = rows.filter(
      (c, i) => !(i === 0 && c.some((v) => /이름|아이디|학번|비밀번호|이메일|번호|성명/.test(v)))
    );
    const parsed = filtered
      .map((c) => ({
        name: (c[0] ?? "").trim(),
        username: (c[1] ?? "").trim(),
        password: (c[2] ?? "").trim() || commonPw || "",
      }))
      .filter((s) => s.name && s.username);
    if (parsed.length === 0) {
      setImportMsg(
        source === "file"
          ? "엑셀에서 이름·아이디를 찾지 못했어요. 첫 열=이름, 둘째 열=아이디, 셋째 열=비밀번호(선택) 순서인지 확인해 주세요."
          : "붙여넣은 내용에서 이름·아이디를 찾지 못했어요. 한 줄에 한 명씩, 이름[탭]아이디[탭]비밀번호 형식으로 넣어주세요."
      );
      return;
    }
    const missingPw = parsed.filter((s) => !s.password).length;
    setStudents(parsed);
    setImportMsg(
      `${parsed.length}명 불러왔어요.` +
        (missingPw > 0 ? ` (${missingPw}명은 비밀번호가 비어 있어요 — 공통 비밀번호를 넣거나 아래 표에서 직접 입력하세요.)` : "")
    );
  };

  // 붙여넣은 텍스트(탭·쉼표 구분)를 행으로 변환
  const importPaste = () => {
    const rows = pasteText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\t|,/).map((c) => c.trim()));
    fillFromRows(rows, "paste");
  };

  // 엑셀/CSV 파일 업로드 → 첫 시트를 행 배열로 파싱 (xlsx는 파일 선택 시에만 동적 로드)
  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 다시 선택 가능하게
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][];
      const asStr = rows.map((r) => r.map((c) => (c == null ? "" : String(c).trim())));
      fillFromRows(asStr, "file");
    } catch {
      setImportMsg("엑셀 파일을 읽지 못했어요. .xlsx 또는 .csv 파일인지 확인해 주세요.");
    } finally {
      setImporting(false);
    }
  };

  const addRow = () => setStudents((prev) => [...prev, { name: "", username: "", password: "" }]);

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

    const valid = students.filter((s) => s.name && s.username && s.password);
    if (valid.length === 0) {
      setLoading(false);
      return;
    }

    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        students: valid.map((s) => ({ name: s.name, email: toEmail(s.username), password: s.password })),
      }),
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

      {/* 엑셀 파일 업로드 */}
      <div className="bg-white rounded-xl shadow p-6 mb-4">
        <h2 className="font-semibold mb-1">📄 엑셀 파일 올리기</h2>
        <p className="text-sm text-gray-500 mb-3">
          <b>이름 / 아이디 / 비밀번호</b> 순서의 엑셀(.xlsx)이나 CSV 파일을 올리면 자동으로 명단을 불러와요. 비밀번호 열이 없으면 공통 비밀번호가 적용됩니다.
        </p>
        <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition cursor-pointer">
          {importing ? "읽는 중..." : "엑셀 파일 선택 (.xlsx, .csv)"}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={importFile} className="hidden" disabled={importing} />
        </label>
        <span className="text-xs text-gray-400 ml-2">첫 시트의 이름·아이디·비밀번호 열을 읽어요</span>
      </div>

      {/* 엑셀 붙여넣기 */}
      <div className="bg-white rounded-xl shadow p-6 mb-4">
        <h2 className="font-semibold mb-1">📋 또는 엑셀에서 붙여넣기</h2>
        <p className="text-sm text-gray-500 mb-3">
          엑셀·구글시트에서 <b>이름 / 아이디 / 비밀번호</b> 열을 복사해 아래에 붙여넣고 &apos;불러오기&apos;를 누르세요. 한 줄에 한 명, 탭이나 쉼표로 구분돼요. 비밀번호 열이 없으면 공통 비밀번호가 적용됩니다.
        </p>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={5}
          placeholder={"김민준\t10101\t1234\n이서연\t10102\t1234\n박도윤\t10103"}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <input
            type="text"
            value={commonPw}
            onChange={(e) => setCommonPw(e.target.value)}
            placeholder="공통 비밀번호 (선택)"
            className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={importPaste}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
          >
            불러오기
          </button>
          {importMsg && <span className="text-sm text-gray-600">{importMsg}</span>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-4">학생 계정 일괄 생성 <span className="font-normal text-gray-400 text-sm">(붙여넣기로 채워지거나, 직접 입력)</span></h2>

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
              <div className="flex-1 flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                <input
                  type="text"
                  value={s.username}
                  onChange={(e) => updateRow(i, "username", e.target.value)}
                  placeholder="아이디 (학번 등)"
                  className="flex-1 min-w-0 px-3 py-2 bg-transparent rounded-l-lg text-sm focus:outline-none"
                />
                <span className="px-2 text-xs text-gray-400 select-none whitespace-nowrap">@{EMAIL_DOMAIN}</span>
              </div>
              <input
                type="password"
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
