// 앱에 기본 제공되는 2022 개정 교육과정 단원 데이터(1~6학년, 출판사별).
// 원본: OneDrive "(12/34/56학년)단원별 핵심 내용 추출" 엑셀 → src/data/curriculum.json.
// 서버에서만 로드한다(2MB). 클라이언트에는 API가 내용(content/standards)을 뺀 인덱스만 내려준다.
import raw from "@/data/curriculum.json";

export interface CurriculumUnit {
  id: number;
  band: string;      // "1-2" | "3-4" | "5-6"
  subject: string;   // 과목
  grade: number;     // 학년
  semester: number;  // 학기
  publisher: string; // 출판사
  unit: string;      // 단원명
  standards: string; // 성취기준
  content: string;   // 단원학습내용 (정답지 본문)
  domain: string;    // 영역
}

// 클라이언트 드롭다운용 경량 항목(정답지 본문 제외)
export type CurriculumIndexItem = Omit<CurriculumUnit, "standards" | "content">;

const UNITS = raw as CurriculumUnit[];

export function getCurriculumIndex(): CurriculumIndexItem[] {
  return UNITS.map(({ standards, content, ...rest }) => {
    void standards;
    void content;
    return rest;
  });
}

export function getCurriculumUnit(id: number): CurriculumUnit | null {
  return UNITS[id] && UNITS[id].id === id ? UNITS[id] : (UNITS.find((u) => u.id === id) ?? null);
}
