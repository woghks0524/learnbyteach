// 로그인/가입 이메일에 자동으로 붙는 가상 도메인.
// 학생은 아이디만 입력하고, 시스템이 `아이디@EMAIL_DOMAIN` 으로 계정을 만든다.
// (추후 Google OAuth 연동 시 이 방식은 대체될 예정)
export const EMAIL_DOMAIN = "learnbyteach.com";

// 아이디를 전체 이메일로 변환. 이미 @가 들어간 값이면 그대로 둔다(기존 계정 호환).
export function toEmail(username: string): string {
  const trimmed = username.trim();
  return trimmed.includes("@") ? trimmed : `${trimmed}@${EMAIL_DOMAIN}`;
}
