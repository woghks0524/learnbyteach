import Link from "next/link";
import PublicNav from "@/components/PublicNav";

export const metadata = {
  title: "소개 · 가르치며 배우기",
  description: "AI 친구를 가르치면서 내가 진짜로 배우는 앱, 가르치며 배우기 소개",
};

const traits = [
  { emoji: "🙋", title: "일부러 모르는 척", desc: "AI 친구는 이 단원을 아직 안 배운 학생이에요. 아는 걸 먼저 알려주지 않고, 여러분이 설명해 주길 기다려요." },
  { emoji: "🔁", title: "배운 걸 되짚어요", desc: "\"그러니까 ~라는 거죠?\" 하고 자기 말로 다시 정리해요. 내 설명이 통했는지 그때 바로 보여요." },
  { emoji: "🤔", title: "가끔 틀리고 우겨요", desc: "자기 생각(오개념)을 자신 있게 말하다가, 여러분이 이유를 제대로 알려주면 \"아! 진짜네요\" 하고 깨달아요." },
  { emoji: "🙉", title: "대충 말하면 못 알아들어요", desc: "얼렁뚱땅 말하면 찰떡같이 알아듣지 않아요. \"좀 더 자세히 알려줄래요?\" 하고 제대로 된 설명을 부탁해요." },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-rose-50 text-gray-800">
      <PublicNav active="about" />

      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        {/* 히어로 */}
        <section className="text-center">
          <div className="flex justify-center items-end -space-x-4 mb-5">
            <img src="/avatars/curious.png" alt="" className="w-16 h-16 rounded-full object-cover ring-4 ring-white shadow-md -rotate-12" />
            <img src="/avatars/default.png" alt="" className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-lg z-10" />
            <img src="/avatars/shy.png" alt="" className="w-16 h-16 rounded-full object-cover ring-4 ring-white shadow-md rotate-12" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">가르치며 배우기</h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            잘 모르는 <b className="text-pink-600">AI 친구</b>를 가르쳐 보세요.<br />
            남에게 설명하다 보면, 내가 진짜로 아는지 저절로 드러나요. ✨
          </p>
        </section>

        {/* 핵심 아이디어 */}
        <section className="mt-12 bg-white rounded-3xl shadow-sm p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-3">🎓 왜 "가르치면" 배울까요?</h2>
          <p className="text-gray-600 leading-relaxed">
            누군가에게 설명하려면, 머릿속에서 흩어져 있던 걸 <b>내 말로 다시 정리</b>해야 해요.
            이 과정에서 아는 것과 모르는 것이 뚜렷하게 갈리고, 빈 곳을 스스로 채우게 돼요.
            이걸 교육학에서는 <b>프로테제 효과(가르치며 배우는 효과)</b>라고 불러요.
          </p>
          <p className="text-gray-600 leading-relaxed mt-3">
            그래서 이 앱에서 <b>가르치는 사람은 학생</b>이고, <b>배우는 쪽은 AI 친구</b>예요.
            역할이 뒤바뀌어 있는 게 핵심이에요.
          </p>
        </section>

        {/* AI 친구의 특징 */}
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-4 text-center">🤖 이 AI 친구는 좀 특별해요</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {traits.map((t) => (
              <div key={t.title} className="bg-white rounded-2xl shadow-sm p-5">
                <div className="text-3xl mb-2">{t.emoji}</div>
                <h3 className="font-bold mb-1">{t.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            그리고 이 친구는 <b>수업 내내 한 명</b>이에요. 이름·성격·얼굴이 처음부터 끝까지 똑같아서, 진짜 친구를 가르치는 느낌이 나요.
          </p>
        </section>

        {/* 대상 */}
        <section className="mt-8 bg-white rounded-3xl shadow-sm p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-3">👩‍🏫 누구를 위한 앱인가요?</h2>
          <ul className="space-y-2 text-gray-600">
            <li>• <b>초등학교·중학교 선생님</b> — 단원을 정하면 AI가 학습 단계와 흔한 오개념까지 초안으로 만들어 줘요.</li>
            <li>• <b>학생</b> — 어려운 문제를 푸는 대신, AI 친구에게 설명하며 개념을 확실히 다져요.</li>
          </ul>
        </section>

        {/* CTA */}
        <section className="mt-10 text-center">
          <Link
            href="/login"
            className="inline-block px-8 py-3.5 text-lg bg-gradient-to-r from-pink-400 to-rose-400 text-white rounded-full hover:from-pink-500 hover:to-rose-500 transition font-bold shadow-md active:scale-[0.98]"
          >
            지금 시작하기 🚀
          </Link>
          <p className="mt-3 text-sm text-gray-500">
            처음이라면 <Link href="/guide" className="text-pink-600 font-bold hover:underline">사용법 먼저 보기 →</Link>
          </p>
        </section>

        <footer className="mt-14 text-center text-xs text-gray-400">가르치며 배우기 · AI 친구를 가르치면 내가 똑똑해져요</footer>
      </main>
    </div>
  );
}
