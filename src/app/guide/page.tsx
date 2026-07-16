import Link from "next/link";
import PublicNav from "@/components/PublicNav";

export const metadata = {
  title: "사용법 · 가르치며 배우기",
  description: "가르치며 배우기 사용법 — 교사용 수업 만들기, 학생용 AI 친구 가르치기",
};

const teacherSteps = [
  { n: 1, title: "수업 개설하기", body: "학년·학기·과목·단원을 고르면 그 단원의 정답지가 자동으로 준비돼요. 수업 이름만 확인하면 끝!" },
  { n: 2, title: "학습 단계 만들기", body: "🪄 AI로 자동 구성하면 흔한 오개념·선수학습·학습 단계(완료 기준)를 초안으로 채워 줘요. 마음에 안 들면 + 단계 추가로 직접 만들거나, \"이 부분만\" AI로 단계를 더 붙일 수도 있어요." },
  { n: 3, title: "AI 학생 정하기", body: "설정에서 AI 친구의 이름과 성격(수동적·호기심·도전적), 이해 수준(낮음·보통·높음)을 골라요. 수업 전체에 걸친 한 명이라 한 번만 정하면 돼요." },
  { n: 4, title: "학생 등록하기", body: "반(그룹)을 만들어 학생들을 넣으면, 수업에 한 번에 등록돼요. 학생 계정은 아이디만 있으면 만들 수 있어요." },
  { n: 5, title: "지켜보기", body: "대화 열람 탭에서 학생별 대화를 보고, 어느 개념을 이해했는지·어디서 막혔는지 확인해요." },
];

const studentSteps = [
  { n: 1, title: "로그인하기", body: "선생님이 준 아이디와 비밀번호로 들어가요." },
  { n: 2, title: "수업 들어가기", body: "내 수업에서 오늘 배울 수업을 눌러요. AI 친구가 \"오늘은 뭐 배워요?\" 하고 기다리고 있어요." },
  { n: 3, title: "설명하며 가르치기", body: "배운 내용을 AI 친구에게 내 말로 알려줘요. 친구가 되묻거나 헷갈려하면, 예를 들거나 다시 쉽게 설명해 주면 돼요." },
  { n: 4, title: "다음 단계로", body: "친구가 \"이제 알겠어요!\" 하고 충분히 이해하면 단계가 완료돼요. \"다음으로\" 버튼을 눌러 이어서 가르쳐요." },
];

function StepCard({ n, title, body, color }: { n: number; title: string; body: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex gap-4">
      <span className={`shrink-0 w-9 h-9 rounded-full ${color} text-white font-bold flex items-center justify-center`}>{n}</span>
      <div>
        <h3 className="font-bold mb-1">{title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-rose-50 text-gray-800">
      <PublicNav active="guide" />

      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">사용법</h1>
          <p className="text-gray-600">선생님과 학생, 각자 이렇게 쓰면 돼요.</p>
        </header>

        {/* 교사용 */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">👩‍🏫</span>
            <h2 className="text-2xl font-bold">선생님이라면</h2>
          </div>
          <div className="space-y-3">
            {teacherSteps.map((s) => (
              <StepCard key={s.n} {...s} color="bg-pink-400" />
            ))}
          </div>
          <div className="mt-4 bg-pink-100/60 rounded-2xl p-4 text-sm text-pink-800 leading-relaxed">
            💡 <b>팁</b> — AI가 만든 단계가 단원 전체라 부담되면, 그냥 필요한 <b>차시(부분)만</b> "이 부분만 단계 만들기"로 뽑아 쓰세요. 하나씩 붙여 가며 운영할 수 있어요.
          </div>
        </section>

        {/* 학생용 */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🧑‍🎓</span>
            <h2 className="text-2xl font-bold">학생이라면</h2>
          </div>
          <div className="space-y-3">
            {studentSteps.map((s) => (
              <StepCard key={s.n} {...s} color="bg-rose-400" />
            ))}
          </div>
          <div className="mt-4 bg-rose-100/60 rounded-2xl p-4 text-sm text-rose-800 leading-relaxed">
            💡 <b>잘 가르치는 법</b> — 정답만 툭 던지지 말고, <b>왜 그런지</b>까지 알려줘요. AI 친구가 틀리게 알고 있으면 <b>이유를 들어</b> 고쳐 주면, 친구가 확실히 배워요!
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <Link
            href="/login"
            className="inline-block px-8 py-3.5 text-lg bg-gradient-to-r from-pink-400 to-rose-400 text-white rounded-full hover:from-pink-500 hover:to-rose-500 transition font-bold shadow-md active:scale-[0.98]"
          >
            들어가기 🚀
          </Link>
          <p className="mt-3 text-sm text-gray-500">
            앱이 궁금하다면 <Link href="/about" className="text-pink-600 font-bold hover:underline">소개 보기 →</Link>
          </p>
        </section>

        <footer className="mt-14 text-center text-xs text-gray-400">가르치며 배우기 · AI 친구를 가르치면 내가 똑똑해져요</footer>
      </main>
    </div>
  );
}
