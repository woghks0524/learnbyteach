"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EMAIL_DOMAIN, toEmail } from "@/lib/constants";

interface StudentRow { id: string; name: string; email: string }
interface Group { id: string; name: string; students: StudentRow[] }

export default function StudentManagementPage() {
  const router = useRouter();
  const [students, setStudents] = useState([{ name: "", username: "", password: "" }]);
  const [results, setResults] = useState<{ email: string; success: boolean; error?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const [pageTab, setPageTab] = useState<"add" | "manage">("add");

  // 내 학생 목록 + 그룹
  const [myStudents, setMyStudents] = useState<StudentRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");

  const loadMine = () => {
    fetch("/api/students?mine=1").then((r) => r.json()).then((d) => Array.isArray(d) && setMyStudents(d));
    fetch("/api/groups").then((r) => r.json()).then((d) => Array.isArray(d) && setGroups(d));
  };
  useEffect(() => { loadMine(); }, []);

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const createGroup = async () => {
    if (!groupName.trim() || selected.size === 0) return;
    await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName.trim(), studentIds: [...selected] }),
    });
    setGroupName("");
    setSelected(new Set());
    loadMine();
  };

  const deleteGroup = async (g: Group) => {
    if (!window.confirm(`"${g.name}" 그룹을 삭제할까요? (학생 계정은 그대로 남아요)`)) return;
    await fetch(`/api/groups/${g.id}`, { method: "DELETE" });
    loadMine();
  };

  // 학생 계정 삭제 / 비밀번호 초기화
  const deleteStudent = async (st: StudentRow) => {
    if (!window.confirm(`"${st.name}" 학생 계정을 삭제할까요?\n이 학생의 대화 기록·수업 등록이 모두 사라지고 되돌릴 수 없어요.`)) return;
    await fetch(`/api/students/${st.id}`, { method: "DELETE" });
    loadMine();
  };
  const resetPassword = async (st: StudentRow) => {
    const pw = window.prompt(`"${st.name}" 학생의 새 비밀번호를 입력하세요 (4자 이상)`);
    if (!pw) return;
    const res = await fetch(`/api/students/${st.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    alert(res.ok ? "비밀번호가 변경됐어요." : "변경에 실패했어요 (4자 이상인지 확인).");
  };

  // 그룹 멤버 편집
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editMembers, setEditMembers] = useState<Set<string>>(new Set());
  const [editName, setEditName] = useState("");
  const openGroupEdit = (g: Group) => {
    setEditingGroup(g);
    setEditName(g.name);
    setEditMembers(new Set(g.students.map((s) => s.id)));
  };
  const saveGroupEdit = async () => {
    if (!editingGroup) return;
    await fetch(`/api/groups/${editingGroup.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() || editingGroup.name, studentIds: [...editMembers] }),
    });
    setEditingGroup(null);
    loadMine();
  };

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

  // 빈 양식(.xlsx) 내려받기 — 교사가 이 파일에 명단을 적어 다시 올리면 됨
  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const rows = [
      ["이름", "아이디", "비밀번호"],
      ["홍길동", "hong01", "1234"],
      ["김영희", "kim02", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "학생명단");
    XLSX.writeFile(wb, "학생명단_양식.xlsx");
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
    loadMine(); // 새로 만든 학생을 목록에 반영
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button onClick={() => router.push("/teacher")} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; 대시보드로
      </button>
      <h1 className="text-2xl font-bold mb-4">학생 계정 관리</h1>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 max-w-md">
        <button onClick={() => setPageTab("add")} className={`flex-1 py-2 rounded-md text-sm font-medium transition ${pageTab === "add" ? "bg-white shadow" : "text-gray-600"}`}>➕ 학생 추가</button>
        <button onClick={() => setPageTab("manage")} className={`flex-1 py-2 rounded-md text-sm font-medium transition ${pageTab === "manage" ? "bg-white shadow" : "text-gray-600"}`}>👥 내 학생·그룹 ({myStudents.length})</button>
      </div>

      {pageTab === "add" && (
      <div>
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-600 text-blue-700 rounded-lg text-sm hover:bg-blue-50 transition"
          >
            📥 빈 양식 내려받기
          </button>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition cursor-pointer">
            {importing ? "읽는 중..." : "엑셀 파일 선택 (.xlsx, .csv)"}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importFile} className="hidden" disabled={importing} />
          </label>
        </div>
        <p className="text-xs text-gray-400 mt-2">양식을 내려받아 명단을 적은 뒤 그대로 올리면 돼요. 첫 시트의 이름·아이디·비밀번호 열을 읽어요.</p>
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
      )}

      {/* 내 학생 + 그룹 (관리 탭) — 넓게 2단 배치 */}
      {pageTab === "manage" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">👥 내 학생 <span className="font-normal text-gray-400 text-sm">({myStudents.length}명)</span></h2>
          {selected.size > 0 && <span className="text-sm text-blue-600">{selected.size}명 선택됨</span>}
        </div>
        <p className="text-sm text-gray-500 mb-3">내가 만든 학생이에요. 체크해서 그룹(반)으로 묶으면 수업 개설 때 한 번에 등록할 수 있어요.</p>

        {myStudents.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">아직 만든 학생이 없어요. 위에서 계정을 만들어 주세요.</p>
        ) : (
          <>
            <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-lg divide-y">
              {myStudents.map((st) => (
                <div key={st.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input type="checkbox" checked={selected.has(st.id)} onChange={() => toggleSelect(st.id)} className="rounded" />
                    <span className="text-sm font-medium">{st.name}</span>
                    <span className="text-xs text-gray-400 truncate">{st.email.replace(`@${EMAIL_DOMAIN}`, "")}</span>
                  </label>
                  <button type="button" onClick={() => resetPassword(st)} className="text-xs text-gray-400 hover:text-blue-600 shrink-0" title="비밀번호 초기화">🔑</button>
                  <button type="button" onClick={() => deleteStudent(st)} className="text-xs text-gray-300 hover:text-red-500 shrink-0" title="학생 삭제">🗑</button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="그룹 이름 (예: 4학년 3반)"
                className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={createGroup}
                disabled={!groupName.trim() || selected.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-40"
              >
                선택한 {selected.size}명으로 그룹 만들기
              </button>
            </div>
          </>
        )}

      </div>

      {/* 그룹 (오른쪽 칼럼) */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-3">📋 그룹(반) <span className="font-normal text-gray-400 text-sm">({groups.length}개)</span></h2>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">왼쪽에서 학생을 골라 그룹(반)을 만들어보세요.</p>
        ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.id} className="px-3 py-2 bg-gray-50 rounded-lg">
                  {editingGroup?.id === g.id ? (
                    <div className="space-y-2">
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" placeholder="그룹 이름" />
                      <div className="max-h-40 overflow-y-auto bg-white border border-gray-200 rounded divide-y">
                        {myStudents.map((st) => (
                          <label key={st.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 text-sm">
                            <input type="checkbox" checked={editMembers.has(st.id)} onChange={() => setEditMembers((prev) => { const n = new Set(prev); n.has(st.id) ? n.delete(st.id) : n.add(st.id); return n; })} className="rounded" />
                            {st.name}
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={saveGroupEdit} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">저장 ({editMembers.size}명)</button>
                        <button type="button" onClick={() => setEditingGroup(null)} className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-600">취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{g.name}</span>
                        <span className="text-xs text-gray-500 ml-2">{g.students.length}명</span>
                        <p className="text-xs text-gray-400 truncate">{g.students.map((s) => s.name).join(", ") || "(비어 있음)"}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => openGroupEdit(g)} className="text-gray-400 hover:text-blue-600 px-2 text-sm" title="멤버·이름 편집">✏️</button>
                        <button type="button" onClick={() => deleteGroup(g)} className="text-gray-300 hover:text-red-500 px-2" title="그룹 삭제">🗑</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
        )}
      </div>
      </div>
      )}
    </div>
  );
}
