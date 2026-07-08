// 로그인/가입 이메일에 자동으로 붙는 가상 도메인.
// 학생은 아이디만 입력하고, 시스템이 `아이디@EMAIL_DOMAIN` 으로 계정을 만든다.
// (추후 Google OAuth 연동 시 이 방식은 대체될 예정)
export const EMAIL_DOMAIN = "learnbyteach.com";

// 아이디를 전체 이메일로 변환. 이미 @가 들어간 값이면 그대로 둔다(기존 계정 호환).
export function toEmail(username: string): string {
  const trimmed = username.trim();
  return trimmed.includes("@") ? trimmed : `${trimmed}@${EMAIL_DOMAIN}`;
}

// 채팅 = "AI 학생 연기"가 이 앱의 본질이라 4o 유지 (오개념 저항·캐릭터 유지 등 연기력이 핵심).
// 비용을 줄여야 하면 COST_ANALYSIS.md §4의 하이브리드(채팅만 gpt-4o-mini)로 전환.
export const CHAT_MODEL = "gpt-4o";
export const JUDGE_MODEL = "gpt-4o";

// DB에 문자열로 저장된 JSON 필드 파싱 — 깨진 데이터가 있어도 500 대신 기본값으로 진행
export function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseJsonObject(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
