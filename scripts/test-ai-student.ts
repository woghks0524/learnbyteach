import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const anthropic = new Anthropic({ timeout: 60000 });

// Rate limit: 순차 요청 사이에 딜레이
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// 재시도 래퍼
async function callWithRetry(fn: () => Promise<any>, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (i === retries - 1) throw e;
      const waitTime = (i + 1) * 5000;
      console.log(`  재시도 ${i + 1}/${retries} (${waitTime/1000}s 후)...`);
      await delay(waitTime);
    }
  }
}

// ===== 테스트 시나리오 정의 =====
interface TestScenario {
  name: string;
  subject: string;
  unit: string;
  gradeLevel: string;
  comprehensionLevel: string;
  personality: string;
  knownTopics: string[];
  unknownTopics: string[];
  misconceptions: string[];
  teacherMessages: string[]; // 선생님(테스터)이 보낼 메시지들
  evaluationFocus: string[]; // 이 시나리오에서 특별히 평가할 항목
}

const scenarios: TestScenario[] = [
  // === 과학 시나리오 ===
  {
    name: "중2과학_광합성_기초설명",
    subject: "과학", unit: "광합성", gradeLevel: "중학교 2학년",
    comprehensionLevel: "low", personality: "curious",
    knownTopics: ["식물은 햇빛이 필요하다"],
    unknownTopics: ["엽록체", "포도당 합성 과정", "기공"],
    misconceptions: ["식물은 흙에서 양분을 흡수해서 자란다고 생각함"],
    teacherMessages: [
      "오늘은 광합성에 대해 배워볼 거야. 광합성이 뭔지 알아?",
      "광합성은 식물이 빛 에너지를 이용해서 이산화탄소와 물로 포도당을 만드는 과정이야.",
      "맞아, 식물은 흙에서 양분을 가져오는 게 아니라 스스로 만들어. 빛이 있어야 해.",
      "엽록체라는 곳에서 일어나. 잎의 세포 안에 있는 초록색 알갱이야.",
      "포도당은 식물의 에너지원이야. 사람이 밥 먹는 것처럼 식물은 포도당을 써."
    ],
    evaluationFocus: ["오개념 드러내기", "모르는 용어 반응", "단계적 이해"]
  },
  {
    name: "중2과학_광합성_심화질문",
    subject: "과학", unit: "광합성", gradeLevel: "중학교 2학년",
    comprehensionLevel: "high", personality: "challenging",
    knownTopics: ["광합성 기본 과정", "이산화탄소와 산소"],
    unknownTopics: ["명반응과 암반응", "캘빈 회로"],
    misconceptions: ["광합성은 낮에만, 호흡은 밤에만 일어난다고 생각함"],
    teacherMessages: [
      "광합성에서 빛이 하는 역할에 대해 더 자세히 설명해줄게.",
      "빛 에너지가 물을 분해해서 산소를 만들어. 이걸 명반응이라고 해.",
      "맞아, 식물도 호흡을 해. 광합성이랑 호흡은 동시에 일어나.",
      "낮에는 광합성이 호흡보다 활발해서 산소를 내보내는 거야.",
      "밤에는 광합성을 못 하니까 호흡만 하고, 이산화탄소를 내보내지."
    ],
    evaluationFocus: ["오개념 자연스럽게 드러내기", "범위 밖 용어 반응", "날카로운 질문"]
  },
  {
    name: "중3과학_원자모형_저수준",
    subject: "과학", unit: "원자의 구조", gradeLevel: "중학교 3학년",
    comprehensionLevel: "low", personality: "passive",
    knownTopics: ["물질은 원자로 이루어져 있다"],
    unknownTopics: ["전자", "양성자", "중성자", "전자 배치"],
    misconceptions: ["원자는 공처럼 꽉 찬 덩어리라고 생각함"],
    teacherMessages: [
      "원자가 뭔지 알지? 오늘은 원자 안에 뭐가 있는지 배울 거야.",
      "원자는 사실 가운데 핵이 있고, 그 주변을 전자가 돌고 있어.",
      "핵 안에는 양성자와 중성자가 있어. 양성자는 +전하, 전자는 -전하야.",
      "원자 대부분은 빈 공간이야. 핵은 아주아주 작아.",
      "양성자 수가 원소를 결정해. 수소는 1개, 헬륨은 2개."
    ],
    evaluationFocus: ["오개념 드러내기", "수동적 반응 패턴", "모르는 용어 처리"]
  },
  // === 수학 시나리오 ===
  {
    name: "중1수학_일차방정식_기초",
    subject: "수학", unit: "일차방정식", gradeLevel: "중학교 1학년",
    comprehensionLevel: "medium", personality: "curious",
    knownTopics: ["사칙연산", "등호의 의미"],
    unknownTopics: ["미지수", "이항", "등식의 성질"],
    misconceptions: ["등호를 '답이 나온다'는 의미로만 이해함 (3+2=5에서 =는 계산 결과)"],
    teacherMessages: [
      "오늘은 방정식에 대해 배울 거야. x + 3 = 7 이런 거 본 적 있어?",
      "여기서 x는 모르는 수야. 미지수라고 해. x가 뭔지 찾는 게 방정식을 푸는 거야.",
      "등호(=)는 양쪽이 같다는 뜻이야. 저울처럼 균형이 맞아야 해.",
      "양쪽에 같은 수를 더하거나 빼도 등호는 유지돼. x+3=7에서 양쪽에서 3을 빼면?",
      "맞아! x = 4가 되지. 이렇게 항을 옮기는 걸 이항이라고 해."
    ],
    evaluationFocus: ["등호 오개념 드러내기", "추상적 개념 이해 과정", "질문 품질"]
  },
  {
    name: "고1수학_함수_개념",
    subject: "수학", unit: "함수", gradeLevel: "고등학교 1학년",
    comprehensionLevel: "medium", personality: "challenging",
    knownTopics: ["좌표평면", "일차함수 그래프"],
    unknownTopics: ["함수의 정의역과 치역", "합성함수", "역함수"],
    misconceptions: ["모든 그래프는 함수라고 생각함", "y=x²의 역함수가 y=√x라고 생각함"],
    teacherMessages: [
      "함수에 대해 좀 더 깊이 알아보자. 함수가 정확히 뭐야?",
      "함수는 하나의 입력에 하나의 출력이 대응되는 관계야.",
      "그래서 원의 방정식 x²+y²=1은 함수가 아니야. x=0일 때 y가 1, -1 두 개거든.",
      "정의역은 입력값의 범위, 치역은 출력값의 범위야.",
      "역함수는 입력과 출력을 바꾼 거야. f(x)=2x의 역함수는 f⁻¹(x)=x/2."
    ],
    evaluationFocus: ["그래프=함수 오개념 드러내기", "범위 밖 개념 반응", "반박 질문"]
  },
  {
    name: "중2수학_확률_기초",
    subject: "수학", unit: "확률", gradeLevel: "중학교 2학년",
    comprehensionLevel: "low", personality: "curious",
    knownTopics: ["분수", "비율"],
    unknownTopics: ["경우의 수", "확률의 덧셈", "독립사건"],
    misconceptions: ["동전을 5번 던져서 다 앞면이면 다음에는 뒷면이 나올 확률이 높다고 생각함"],
    teacherMessages: [
      "오늘은 확률 배울 거야. 동전 던지면 앞면 나올 확률이 얼마게?",
      "맞아 1/2이지. 확률은 '원하는 경우의 수 / 전체 경우의 수'로 구해.",
      "주사위를 던져서 3이 나올 확률은? 전체 경우의 수는 6이고 원하는 건 1이니까 1/6이야.",
      "그럼 동전을 두 번 던져서 둘 다 앞면이 나올 확률은?",
      "각각 1/2이고 독립이니까 1/2 × 1/2 = 1/4야. 앞에 뭐가 나왔는지는 다음에 영향 안 줘."
    ],
    evaluationFocus: ["도박사의 오류 드러내기", "독립사건 이해 과정", "일상 연결"]
  },
  // === 국어/사회 시나리오 ===
  {
    name: "중3국어_비유법",
    subject: "국어", unit: "비유와 상징", gradeLevel: "중학교 3학년",
    comprehensionLevel: "medium", personality: "curious",
    knownTopics: ["직유법 (∼처럼, ∼같이)"],
    unknownTopics: ["은유법", "의인법", "상징"],
    misconceptions: ["'처럼'이 없으면 비유가 아니라고 생각함"],
    teacherMessages: [
      "비유법에 대해 알아보자. 직유법은 알지?",
      "은유법은 '처럼' 없이 바로 비유하는 거야. '내 마음은 호수'처럼.",
      "의인법은 사람이 아닌 것을 사람처럼 표현하는 거야. '바람이 속삭인다'처럼.",
      "상징은 좀 달라. 구체적인 사물로 추상적인 의미를 나타내는 거야. '비둘기=평화'처럼.",
      "시에서 '길'이 나오면 단순히 도로가 아니라 '인생'을 상징할 수 있어."
    ],
    evaluationFocus: ["처럼 없으면 비유 아님 오개념", "추상적 개념 이해", "예시 요청"]
  },
  {
    name: "중2사회_민주주의",
    subject: "사회", unit: "민주주의와 인권", gradeLevel: "중학교 2학년",
    comprehensionLevel: "medium", personality: "challenging",
    knownTopics: ["투표", "대통령"],
    unknownTopics: ["삼권분립", "기본권의 종류", "위헌법률심사"],
    misconceptions: ["다수결이면 무조건 민주적이라고 생각함"],
    teacherMessages: [
      "민주주의에서 가장 중요한 게 뭘까?",
      "다수결도 중요하지만, 소수의 권리도 보호해야 해. 그게 진짜 민주주의야.",
      "그래서 삼권분립이 있어. 국회, 정부, 법원이 서로 견제하는 거야.",
      "법원은 국회가 만든 법이 헌법에 어긋나면 무효로 만들 수 있어.",
      "기본권에는 자유권, 평등권, 참정권, 사회권 같은 게 있어."
    ],
    evaluationFocus: ["다수결=민주주의 오개념", "범위 밖 반응", "비판적 질문"]
  },
  // === 영어/역사 시나리오 ===
  {
    name: "중1영어_현재진행형",
    subject: "영어", unit: "현재진행형", gradeLevel: "중학교 1학년",
    comprehensionLevel: "low", personality: "passive",
    knownTopics: ["be동사 (am, is, are)", "일반동사 현재형"],
    unknownTopics: ["현재진행형 구조", "-ing 만드는 규칙"],
    misconceptions: ["현재형이랑 현재진행형이 같다고 생각함 (I eat = I am eating)"],
    teacherMessages: [
      "오늘은 현재진행형을 배워볼 거야. 'I am eating'같은 거야.",
      "현재진행형은 '지금 하고 있는 중'이라는 뜻이야. be동사 + 동사ing 형태야.",
      "I eat은 '나는 (평소에) 먹어', I am eating은 '나는 지금 먹고 있어'야.",
      "'e'로 끝나는 동사는 e를 빼고 ing를 붙여. make → making.",
      "know, like 같은 동사는 진행형으로 잘 안 써. 상태를 나타내는 동사거든."
    ],
    evaluationFocus: ["현재형=현재진행형 오개념", "수동적 반응", "문법 규칙 이해"]
  },
  {
    name: "고1역사_산업혁명",
    subject: "역사", unit: "산업혁명", gradeLevel: "고등학교 1학년",
    comprehensionLevel: "high", personality: "curious",
    knownTopics: ["영국이 산업혁명의 시작", "증기기관"],
    unknownTopics: ["러다이트 운동", "차티스트 운동", "제2차 산업혁명"],
    misconceptions: ["산업혁명이 모든 사람에게 좋았다고 생각함"],
    teacherMessages: [
      "산업혁명이 영국에서 시작된 이유가 뭘까?",
      "풍부한 석탄과 철, 식민지 시장, 그리고 인클로저 운동으로 노동력이 생겼어.",
      "하지만 노동자들은 하루 16시간 일하고 아동 노동도 심했어.",
      "그래서 기계를 부수는 러다이트 운동이 일어났어. 기계가 일자리를 뺏는다고.",
      "결국 노동법이 만들어지고, 노동조합이 합법화됐어."
    ],
    evaluationFocus: ["산업혁명 긍정편향 오개념", "범위 밖 개념 처리", "깊은 탐구 질문"]
  },
  // === 추가 변형 시나리오 (다양한 조합) ===
  {
    name: "중2과학_소화_호기심",
    subject: "과학", unit: "소화와 흡수", gradeLevel: "중학교 2학년",
    comprehensionLevel: "medium", personality: "curious",
    knownTopics: ["음식을 먹으면 위에서 소화된다"],
    unknownTopics: ["소장 융털", "효소", "영양소별 소화 과정"],
    misconceptions: ["소화는 위에서만 일어난다고 생각함"],
    teacherMessages: [
      "음식을 먹으면 어떻게 되는지 배워보자. 소화가 어디서 일어나는지 알아?",
      "사실 소화는 입에서부터 시작돼. 침에 있는 아밀레이스가 녹말을 분해해.",
      "위에서는 위산과 펩신이 단백질을 분해하고, 소장에서 대부분의 영양소를 흡수해.",
      "소장 안에는 융털이라는 게 있어. 표면적을 넓혀서 흡수를 잘 하게 해.",
      "대장은 주로 물을 흡수하고, 남은 건 변으로 나가."
    ],
    evaluationFocus: ["위에서만 소화 오개념", "효소 개념 이해", "일상 연결 질문"]
  },
  {
    name: "고1물리_힘과운동",
    subject: "물리", unit: "힘과 운동", gradeLevel: "고등학교 1학년",
    comprehensionLevel: "high", personality: "challenging",
    knownTopics: ["속력 = 거리/시간", "중력"],
    unknownTopics: ["가속도", "뉴턴의 제2법칙 F=ma", "관성"],
    misconceptions: ["무거운 물체가 더 빨리 떨어진다고 생각함", "힘이 없으면 물체가 멈춘다고 생각함"],
    teacherMessages: [
      "힘과 운동의 관계를 알아보자. 물체에 힘을 주면 어떻게 돼?",
      "힘은 물체의 운동 상태를 바꿔. 속도가 변하는 거지. 이걸 가속도라고 해.",
      "뉴턴의 제1법칙은 관성의 법칙이야. 힘이 안 작용하면 운동 상태가 유지돼.",
      "공기 저항이 없으면 깃털과 볼링공은 동시에 떨어져. 달에서 실험한 적 있어.",
      "F=ma야. 같은 힘이면 가벼운 물체가 더 많이 가속돼."
    ],
    evaluationFocus: ["무거운 물체 빨리 떨어짐 오개념", "힘 없으면 멈춤 오개념", "반례 질문"]
  },
  {
    name: "중1수학_정수_음수",
    subject: "수학", unit: "정수와 유리수", gradeLevel: "중학교 1학년",
    comprehensionLevel: "low", personality: "passive",
    knownTopics: ["자연수", "덧셈과 뺄셈"],
    unknownTopics: ["음수", "절댓값", "정수의 사칙연산"],
    misconceptions: ["음수끼리 곱하면 음수가 된다고 생각함", "0은 양수라고 생각함"],
    teacherMessages: [
      "오늘은 음수에 대해 배워볼 거야. 영하 5도 같은 거 알지?",
      "0보다 작은 수를 음수라고 해. -1, -2, -3 이런 거야.",
      "음수끼리 더하면 더 작아져. (-3) + (-2) = -5",
      "근데 음수끼리 곱하면 양수가 돼! (-3) × (-2) = 6",
      "0은 양수도 아니고 음수도 아니야. 딱 경계에 있는 수야."
    ],
    evaluationFocus: ["음수 곱셈 오개념", "0 양수 오개념", "직관적 이해 어려움"]
  },
  {
    name: "중3과학_유전_표면설명",
    subject: "과학", unit: "유전", gradeLevel: "중학교 3학년",
    comprehensionLevel: "medium", personality: "curious",
    knownTopics: ["부모를 닮는다", "DNA라는 것이 있다"],
    unknownTopics: ["유전자", "대립유전자", "우성과 열성", "멘델의 법칙"],
    misconceptions: ["우성=좋은 것, 열성=나쁜 것이라고 생각함"],
    teacherMessages: [
      "유전에 대해 알아보자. 왜 부모를 닮는 걸까?",
      "유전자가 부모로부터 전달되기 때문이야. 유전자는 DNA에 있어.",
      "같은 형질에 대해 두 개의 유전자를 가져. 하나는 엄마, 하나는 아빠한테서.",
      "둘 중 하나만 나타나는 게 우성, 가려지는 게 열성이야.",
      "열성이라고 나쁜 게 아니야. 그냥 발현이 안 되는 거야. 파란 눈이 열성이야."
    ],
    evaluationFocus: ["우성=좋은 것 오개념", "유전자 개념 이해 과정", "탐구 질문"]
  },
  {
    name: "중2사회_경제_수요공급",
    subject: "사회", unit: "시장 경제", gradeLevel: "중학교 2학년",
    comprehensionLevel: "low", personality: "curious",
    knownTopics: ["물건을 사고 판다", "가격"],
    unknownTopics: ["수요와 공급", "균형 가격", "시장 실패"],
    misconceptions: ["가격은 기업이 마음대로 정한다고 생각함"],
    teacherMessages: [
      "시장에서 가격이 어떻게 결정되는지 알아볼까?",
      "수요는 사려는 양, 공급은 팔려는 양이야. 이 둘이 만나는 데서 가격이 결정돼.",
      "가격이 비싸면 사려는 사람은 줄고, 팔려는 사람은 늘어나.",
      "가격이 싸면 반대로 되겠지? 그래서 어딘가에서 균형을 이뤄.",
      "마스크 대란 때 생각해봐. 갑자기 수요가 확 늘어서 가격이 올랐잖아."
    ],
    evaluationFocus: ["가격=기업이 정함 오개념", "추상적 개념 이해", "일상 예시 연결"]
  },
];

// ===== buildSystemPrompt 함수 (ai-prompt.ts에서 복사) =====
function buildSystemPrompt(config: {
  subject: string; unit: string; gradeLevel: string;
  comprehensionLevel: string; personality: string;
  knownTopics: string[]; unknownTopics: string[];
  misconceptions: string[]; comprehensionState: Record<string, string>;
  knowledgeContent?: string;
}): string {
  const levelDescription: Record<string, string> = {
    low: "이해력이 낮은 편이야. 쉬운 말로 여러 번 설명해줘야 겨우 이해해. 어려운 용어를 쓰면 바로 '그게 뭐야?'라고 물어봐.",
    medium: "보통 수준의 이해력이야. 기본 개념은 한 번 설명하면 알아듣지만, 복잡한 내용은 추가 설명이 필요해.",
    high: "이해력이 꽤 좋은 편이야. 하지만 깊은 원리나 예외 상황에 대해서는 날카로운 질문을 던져.",
  };

  const personalityDescription: Record<string, string> = {
    passive: "수동적인 성격이야. 선생님이 설명하면 주로 듣고, 가끔 '네', '아' 정도로 반응해. 이해가 안 되면 조용히 있다가 나중에 '근데요...'하고 질문해.",
    curious: "호기심이 많은 성격이야. 설명을 들으면 '왜?', '그러면 이건?', '예를 들면?'같은 질문을 자주 해. 관련된 다른 것도 궁금해해.",
    challenging: "도전적인 성격이야. '정말요?', '근데 그러면 이건 어떻게 설명해요?'같은 반박성 질문을 잘 해. 논리적 빈틈을 잘 찾아내.",
  };

  const knownSection = config.knownTopics.length > 0
    ? `\n이미 알고 있는 것들: ${config.knownTopics.join(", ")}`
    : "";
  const unknownSection = config.unknownTopics.length > 0
    ? `\n아직 모르는 것들 (이것에 대해 설명하면 처음 듣는 것처럼 반응해): ${config.unknownTopics.join(", ")}`
    : "";
  const misconceptionSection = config.misconceptions.length > 0
    ? `\n가지고 있는 오개념들 (선생님이 관련 내용을 설명하면 이 오개념을 드러내면서 혼동해):\n${config.misconceptions.map(m => `- ${m}`).join("\n")}`
    : "";
  const stateSection = Object.keys(config.comprehensionState).length > 0
    ? `\n\n[현재까지 배운 상태]\n${Object.entries(config.comprehensionState).map(([topic, status]) => `- ${topic}: ${status}`).join("\n")}`
    : "";

  return `너는 ${config.gradeLevel} ${config.subject} 수업을 듣는 학생이야.
지금 배우고 있는 단원은 "${config.unit}"이야.

${levelDescription[config.comprehensionLevel] || "보통 수준의 이해력이야."}

${personalityDescription[config.personality] || "호기심이 많은 성격이야."}
${knownSection}
${unknownSection}
${misconceptionSection}
${stateSection}

## 중요한 규칙

1. 너는 학생 역할이야. 절대로 선생님처럼 설명하거나 가르치지 마.
2. 선생님(대화 상대)이 설명해주면 그에 맞게 반응해:
   - 이해했으면: 자기 말로 바꿔서 되물어봐. "아 그러니까 ~라는 거예요?", "그럼 ~랑 비슷한 건가요?"
   - 헷갈리면: 어디가 헷갈리는지 구체적으로 말해. "근데 아까 ~라고 하셨잖아요, 그럼 ~는 어떻게 되는 거예요?", "~부분은 알겠는데 ~부분이 좀 헷갈려요"
   - 모르겠으면: 자기가 알고 있는 것과 연결지어서 질문해. "그거 혹시 ~이랑 관련있는 거예요?", "~은 알겠는데 거기서 왜 ~가 되는지 모르겠어요"
3. 교육과정/교과서 범위 밖의 내용이 나오면:
   - 아예 모르는 용어: "그건 수업시간에 안 배운 것 같은데... 뭔지 알려주세요!"처럼 솔직하게
   - 들어는 본 것: "그거 어디서 들어보긴 했는데 잘 모르겠어요, 쉽게 알려주세요"
   - 비슷한 걸 아는 경우: "혹시 그거 ~이랑 비슷한 건가요? 저는 ~만 배웠거든요"
   자연스럽게, 실제 학생이 수업 범위 밖의 걸 접했을 때처럼 반응해. "그게 뭐야?"같은 로봇 같은 반응은 절대 하지 마.
4. 선생님이 잘 설명해주면 진심으로 이해한 반응을 보여줘. "아아 이제 알 것 같아요!", "오 그렇게 생각하니까 이해돼요!"
5. 한 번에 너무 많이 이해하지 마. 실제 학생처럼 단계적으로, 가끔은 이전에 이해했던 걸 다시 헷갈려하기도 해.
6. 반말로 대화해. 학생답게 편하게, 약간 구어체로 말해. "~인 거죠?", "아~ 그런 거구나", "헐 그럼 ~는요?"
7. 답변은 짧게 해. 한두 문장 정도로. 실제 학생이 수업 중에 하는 반응 길이로.
8. 가끔 자기 경험이나 일상과 연결지어서 말해. "그거 유튜브에서 본 것 같은데...", "아 그래서 ~가 그런 거였구나"

## 질문 전략 — 진짜 학생처럼, 하지만 핵심을 찌르는 질문

너는 그냥 듣고 반응만 하는 학생이 아니야. 진짜 학생도 수업 중에 좋은 질문을 던져. 네가 던지는 질문이 선생님의 진짜 이해도를 드러나게 만들어야 해. 단, 절대로 "시험하는 느낌"이 나면 안 돼. 자연스럽게 궁금해서 묻는 것처럼.

### 핵심 질문 (왜/어떻게를 건드리는 질문)
선생님이 "무엇"만 설명하고 "왜"를 안 말했을 때, 학생다운 방식으로 이유를 물어봐:
- "아 그건 알겠는데, 근데 왜 그렇게 되는 거예요? 원래 그런 건가요?"
- "그게 그렇게 되는 이유가 뭐예요? 걍 외워야 하는 건가요?"
- "그러면 만약에 ~하면 어떻게 돼요?" (조건을 바꿔보는 질문)

### 탐구 질문 (연결·확장·경계를 건드리는 질문)
선생님이 한 가지를 잘 설명하면, 관련된 다른 것으로 자연스럽게 확장해봐:
- "그럼 ~도 같은 원리인 거예요?" (다른 개념과의 연결)
- "근데 그거 반대로 하면 어떻게 되는 거예요?" (역방향 사고)
- "아 그러면 실제로는 어디에 쓰이는 거예요?" (적용/실생활)
- "그거 ~이랑 헷갈리는데, 뭐가 다른 거예요?" (유사 개념 구별)

### 질문 타이밍과 자연스러움
- 매번 질문하지 마. 2~3번 반응 중 1번 정도 질문을 섞어.
- 질문이 갑자기 튀어나오면 부자연스러워. 선생님의 설명을 일부 받아들인 뒤에 이어서 물어봐. "아~ 그런 거구나. 근데 그러면..."
- 선생님이 핵심을 잘 설명했을 때는 질문 대신 진심으로 감탄하거나 자기 말로 정리하는 게 더 자연스러워.
- 선생님이 표면적으로만 설명하고 넘어가려 할 때가 진짜 질문할 타이밍이야. 이때 "아 근데 잠깐, ~는 왜 그런 거예요?"처럼 자연스럽게 파고들어.
- 한 번에 질문을 여러 개 던지지 마. 하나만.

대화를 시작할 때는 "안녕하세요 선생님! 오늘은 뭐 배워요?" 같은 인사로 시작해.`;
}

// ===== 평가 기준 =====
const EVAL_PROMPT = `너는 교육학 전문가이자 AI 프롬프트 평가자야.
AI 학생과 선생님 사이의 대화를 평가해줘.

## 평가 기준 (각 항목 1-5점)

1. **연기력 (naturalness)**: 실제 해당 학년 학생처럼 자연스럽게 말하는가? 어투, 반응, 길이가 적절한가? AI 티가 나지 않는가?
2. **범위 준수 (scope_compliance)**: 모르는 것으로 설정된 주제에 대해 정말 모르는 척 하는가? 설정된 범위 이상의 지식을 보여주지 않는가?
3. **오개념 표현 (misconception_display)**: 설정된 오개념을 자연스럽게 대화 중에 드러내는가? 억지스럽지 않게, 실제 학생이 그런 오개념을 가졌을 때처럼?
4. **질문 품질 (question_quality)**: 던지는 질문이 선생님의 이해도를 시험하는 좋은 질문인가? 핵심 질문(왜/어떻게)과 탐구 질문(연결/확장)을 적절히 사용하는가?
5. **질문 자연스러움 (question_naturalness)**: 질문이 시험하는 느낌 없이 진짜 궁금해서 묻는 것처럼 자연스러운가? 타이밍이 적절한가?
6. **성격 일관성 (personality_consistency)**: 설정된 성격(수동적/호기심/도전적)과 이해 수준(상/중/하)에 맞게 일관되게 행동하는가?
7. **교육적 효과 (educational_value)**: 이 AI 학생과 대화하면 선생님(학생)이 자신의 이해 부족을 깨달을 수 있을까?

## 출력 형식 (JSON)
{
  "scores": {
    "naturalness": <1-5>,
    "scope_compliance": <1-5>,
    "misconception_display": <1-5>,
    "question_quality": <1-5>,
    "question_naturalness": <1-5>,
    "personality_consistency": <1-5>,
    "educational_value": <1-5>
  },
  "issues": ["구체적 문제점 1", "구체적 문제점 2", ...],
  "good_points": ["잘한 점 1", "잘한 점 2", ...],
  "example_bad_lines": ["문제가 되는 AI 학생의 실제 발화를 인용"],
  "example_good_lines": ["잘한 AI 학생의 실제 발화를 인용"],
  "suggestions": ["개선 제안 1", "개선 제안 2", ...]
}

JSON만 반환해.`;

// ===== 실행 로직 =====
interface ConversationResult {
  scenario: string;
  messages: { role: string; content: string }[];
  evaluation: any;
}

async function runSingleConversation(scenario: TestScenario): Promise<ConversationResult> {
  const systemPrompt = buildSystemPrompt({
    ...scenario,
    comprehensionState: {},
  });

  const messages: { role: "user" | "assistant"; content: string }[] = [];
  const fullLog: { role: string; content: string }[] = [];

  // AI 학생의 첫 인사
  await delay(1500);
  const greeting = await callWithRetry(() => anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: systemPrompt,
    messages: [{ role: "user", content: "수업을 시작하자." }],
  }));
  const greetingText = greeting.content[0].type === "text" ? greeting.content[0].text : "";
  messages.push({ role: "user", content: "수업을 시작하자." });
  messages.push({ role: "assistant", content: greetingText });
  fullLog.push({ role: "teacher", content: "수업을 시작하자." });
  fullLog.push({ role: "ai_student", content: greetingText });

  // 선생님 메시지들로 대화 진행
  for (const teacherMsg of scenario.teacherMessages) {
    messages.push({ role: "user", content: teacherMsg });
    fullLog.push({ role: "teacher", content: teacherMsg });

    await delay(1500);
    const response = await callWithRetry(() => anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: systemPrompt,
      messages: messages,
    }));

    const aiText = response.content[0].type === "text" ? response.content[0].text : "";
    messages.push({ role: "assistant", content: aiText });
    fullLog.push({ role: "ai_student", content: aiText });
  }

  // 평가
  await delay(1500);
  const evalInput = `## 시나리오 설정
- 과목: ${scenario.subject}, 단원: ${scenario.unit}, 학년: ${scenario.gradeLevel}
- 이해 수준: ${scenario.comprehensionLevel}, 성격: ${scenario.personality}
- 알고 있는 것: ${scenario.knownTopics.join(", ")}
- 모르는 것: ${scenario.unknownTopics.join(", ")}
- 오개념: ${scenario.misconceptions.join(", ")}
- 평가 중점: ${scenario.evaluationFocus.join(", ")}

## 대화 내용
${fullLog.map(m => `[${m.role}]: ${m.content}`).join("\n\n")}`;

  const evalResponse = await callWithRetry(() => anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: EVAL_PROMPT,
    messages: [{ role: "user", content: evalInput }],
  }));

  const evalText = evalResponse.content[0].type === "text" ? evalResponse.content[0].text : "{}";
  let evaluation;
  try {
    const jsonMatch = evalText.match(/\{[\s\S]*\}/);
    evaluation = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
  } catch {
    evaluation = { raw: evalText, parse_error: true };
  }

  return { scenario: scenario.name, messages: fullLog, evaluation };
}

async function main() {
  console.log("=== AI 학생 프롬프트 테스트 시작 ===\n");
  console.log(`총 시나리오: ${scenarios.length}개`);
  const TARGET = 50;
  const repeats = Math.ceil(TARGET / scenarios.length);
  const total = Math.min(scenarios.length * repeats, TARGET);
  console.log(`각 시나리오당 반복: ${repeats}회`);
  console.log(`총 대화: ${total}회\n`);
  const allResults: ConversationResult[] = [];
  let completed = 0;

  // 순차 실행 (rate limit)
  outer:
  for (let r = 0; r < repeats; r++) {
    for (const scenario of scenarios) {
      if (completed >= total) break outer;
      try {
        const result = await runSingleConversation(scenario);
        allResults.push(result);
      } catch (e: any) {
        console.log(`  ⚠ ${scenario.name} 실패: ${e.message?.substring(0, 60)}`);
      }
      completed++;
      console.log(`진행: ${completed}/${total} (${Math.round(completed/total*100)}%)`);
    }
  }

  // ===== 결과 집계 =====
  const scoreKeys = ["naturalness", "scope_compliance", "misconception_display",
    "question_quality", "question_naturalness", "personality_consistency", "educational_value"];

  const avgScores: Record<string, number> = {};
  const allIssues: string[] = [];
  const allSuggestions: string[] = [];
  const allGoodPoints: string[] = [];
  const allBadLines: string[] = [];
  const allGoodLines: string[] = [];
  const scenarioScores: Record<string, Record<string, number[]>> = {};

  for (const result of allResults) {
    if (result.evaluation?.scores) {
      for (const key of scoreKeys) {
        if (!avgScores[key]) avgScores[key] = 0;
        avgScores[key] += (result.evaluation.scores[key] || 0);
      }
      // 시나리오별 점수
      if (!scenarioScores[result.scenario]) scenarioScores[result.scenario] = {};
      for (const key of scoreKeys) {
        if (!scenarioScores[result.scenario][key]) scenarioScores[result.scenario][key] = [];
        scenarioScores[result.scenario][key].push(result.evaluation.scores[key] || 0);
      }
    }
    if (result.evaluation?.issues) allIssues.push(...result.evaluation.issues);
    if (result.evaluation?.suggestions) allSuggestions.push(...result.evaluation.suggestions);
    if (result.evaluation?.good_points) allGoodPoints.push(...result.evaluation.good_points);
    if (result.evaluation?.example_bad_lines) allBadLines.push(...result.evaluation.example_bad_lines);
    if (result.evaluation?.example_good_lines) allGoodLines.push(...result.evaluation.example_good_lines);
  }

  const validResults = allResults.filter(r => r.evaluation?.scores).length;
  for (const key of scoreKeys) {
    avgScores[key] = Math.round((avgScores[key] / validResults) * 100) / 100;
  }

  // 이슈 빈도 집계
  const issueCounts: Record<string, number> = {};
  for (const issue of allIssues) {
    const normalized = issue.substring(0, 50);
    issueCounts[normalized] = (issueCounts[normalized] || 0) + 1;
  }
  const topIssues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

  const suggestionCounts: Record<string, number> = {};
  for (const s of allSuggestions) {
    const normalized = s.substring(0, 50);
    suggestionCounts[normalized] = (suggestionCounts[normalized] || 0) + 1;
  }
  const topSuggestions = Object.entries(suggestionCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

  // 리포트 생성
  const report = {
    summary: {
      total_conversations: allResults.length,
      valid_evaluations: validResults,
      average_scores: avgScores,
      overall_average: Math.round(Object.values(avgScores).reduce((a, b) => a + b, 0) / scoreKeys.length * 100) / 100,
    },
    scenario_breakdown: Object.entries(scenarioScores).map(([name, scores]) => ({
      scenario: name,
      avg_scores: Object.fromEntries(
        Object.entries(scores).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100])
      ),
    })),
    top_issues: topIssues.map(([issue, count]) => ({ issue, count })),
    top_suggestions: topSuggestions.map(([suggestion, count]) => ({ suggestion, count })),
    sample_good_lines: [...new Set(allGoodLines)].slice(0, 20),
    sample_bad_lines: [...new Set(allBadLines)].slice(0, 20),
    sample_good_points: [...new Set(allGoodPoints)].slice(0, 20),
  };

  // 전체 대화 로그도 저장
  const logData = allResults.map(r => ({
    scenario: r.scenario,
    messages: r.messages,
    scores: r.evaluation?.scores,
    issues: r.evaluation?.issues,
  }));

  fs.writeFileSync("scripts/test-results-report.json", JSON.stringify(report, null, 2));
  fs.writeFileSync("scripts/test-results-full.json", JSON.stringify(logData, null, 2));

  console.log("\n=== 테스트 완료 ===\n");
  console.log("📊 전체 평균 점수:");
  for (const [key, value] of Object.entries(avgScores)) {
    const bar = "█".repeat(Math.round(value)) + "░".repeat(5 - Math.round(value));
    console.log(`  ${key.padEnd(25)} ${bar} ${value}/5`);
  }
  console.log(`\n  ${"OVERALL".padEnd(25)} ${report.summary.overall_average}/5`);

  console.log("\n🔴 주요 문제점 (빈도순):");
  for (const { issue, count } of report.top_issues.slice(0, 10)) {
    console.log(`  [${count}회] ${issue}`);
  }

  console.log("\n💡 주요 개선 제안 (빈도순):");
  for (const { suggestion, count } of report.top_suggestions.slice(0, 10)) {
    console.log(`  [${count}회] ${suggestion}`);
  }

  console.log("\n결과 파일: scripts/test-results-report.json, scripts/test-results-full.json");
}

main().catch(console.error);
