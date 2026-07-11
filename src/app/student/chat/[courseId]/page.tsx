"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Message {
  role: string;
  content: string;
  createdAt?: string;
  kind?: "normal" | "transition";
  stepId?: string | null;
}

interface CourseInfo {
  name: string;
  subject: string;
  unit: string;
}

interface LessonStep {
  id: string;
  order: number;
  title: string;
  aiName: string;
  aiAvatar: string;
}

export default function ChatPage() {
  const { courseId } = useParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [steps, setSteps] = useState<LessonStep[]>([]);
  const [currentStep, setCurrentStep] = useState<LessonStep | null>(null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null); // 지금 보고 있는 단계 탭
  const [allStepsCompleted, setAllStepsCompleted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const startSession = async () => {
      try {
        const [sessionRes, courseRes] = await Promise.all([
          fetch(`/api/instances/${courseId}/start`, { method: "POST" }),
          fetch(`/api/courses/${courseId}`),
        ]);
        if (!sessionRes.ok) {
          const errData = await sessionRes.json().catch(() => ({ error: "서버 오류" }));
          setError(errData.error || "세션을 시작할 수 없습니다");
          setInitializing(false);
          return;
        }
        const data = await sessionRes.json();
        setInstanceId(data.instanceId);
        setMessages(data.messages || []);
        if (data.steps) setSteps(data.steps);
        if (data.currentStep) {
          setCurrentStep(data.currentStep);
          setActiveStepId(data.currentStep.id); // 현재 단계 탭을 기본으로 열어둠
        }
        if (courseRes.ok) {
          const course = await courseRes.json();
          setCourseInfo({ name: course.name, subject: course.subject, unit: course.unit });
        }
      } catch {
        setError("서버에 연결할 수 없습니다");
      } finally {
        setInitializing(false);
      }
    };
    startSession();
  }, [courseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !instanceId || loading) return;

    const userMessage = input.trim();
    const sendingStepId = currentStep?.id ?? null;
    setInput("");
    setMessages((prev) => [...prev, { role: "student", content: userMessage, stepId: sendingStepId }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, message: userMessage }),
      });

      if (!res.ok) {
        throw new Error("응답 오류");
      }

      const data = await res.json();
      setMessages((prev) => {
        const next = [...prev, { role: "ai", content: data.message, stepId: sendingStepId }];
        if (data.transitionMessage && data.newStep) {
          next.push({ role: "ai", content: data.transitionMessage, kind: "transition", stepId: data.newStep.id });
        }
        return next;
      });
      if (data.newStep) {
        setCurrentStep(data.newStep);
        setActiveStepId(data.newStep.id); // 새 단계로 자동 이동
      }
      if (data.allStepsCompleted) setAllStepsCompleted(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "죄송해요, 오류가 발생했어요. 다시 말해주실 수 있어요?" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-sky-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 font-medium">AI 친구를 깨우고 있어요... 🌟</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push("/student")}
            className="text-blue-600 hover:underline"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const hasSteps = steps.length > 0;
  const firstStepId = steps[0]?.id ?? null;
  const stepOf = (m: Message) => m.stepId ?? firstStepId;
  const activeStep = steps.find((s) => s.id === activeStepId) ?? currentStep;
  const isViewingCurrent = !hasSteps || (currentStep != null && activeStepId === currentStep.id);
  const visibleMessages = hasSteps ? messages.filter((m) => stepOf(m) === activeStepId) : messages;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-sky-50">
      <div className="p-4 border-b border-sky-100 bg-white rounded-b-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/student")}
            className="text-xl text-gray-400 hover:text-gray-600 px-1"
            aria-label="내 수업으로 돌아가기"
          >
            &larr;
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{courseInfo?.name || "AI 친구에게 가르치기"}</h1>
            <p className="text-sm text-gray-500 truncate">
              {courseInfo ? `${courseInfo.subject} · ${courseInfo.unit}` : "배운 걸 설명해주면 AI 친구가 질문하며 배워요!"}
            </p>
          </div>
        </div>

        {/* 단계 탭 — 지난 단계로 돌아가 볼 수 있어요 */}
        {hasSteps && currentStep && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {steps.map((s) => {
              const completed = s.order < currentStep.order;
              const locked = s.order > currentStep.order;
              const active = s.id === activeStepId;
              return (
                <button
                  key={s.id}
                  onClick={() => !locked && setActiveStepId(s.id)}
                  disabled={locked}
                  title={s.title}
                  className={`shrink-0 flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full border-2 transition ${
                    active
                      ? "border-sky-400 bg-sky-50"
                      : locked
                      ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                      : "border-transparent bg-white hover:border-sky-200"
                  }`}
                >
                  <img src={`/avatars/${s.aiAvatar}.png`} alt="" className={`w-7 h-7 rounded-full object-cover ${locked ? "grayscale" : ""}`} />
                  <span className="text-sm font-bold text-gray-700">{s.order}단계</span>
                  {completed && <span className="text-green-500 text-sm">✓</span>}
                  {locked && <span className="text-xs">🔒</span>}
                </button>
              );
            })}
          </div>
        )}
        {hasSteps && activeStep && (
          <p className="text-sm text-sky-600 font-medium mt-2 truncate">
            {activeStep.aiName}와 · {activeStep.title}
          </p>
        )}
      </div>

      {!isViewingCurrent && (
        <div className="mx-4 mt-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center justify-between gap-2">
          <span>👀 지난 이야기를 보고 있어요.</span>
          <button
            onClick={() => currentStep && setActiveStepId(currentStep.id)}
            className="shrink-0 font-bold text-amber-800 underline"
          >
            지금 이야기로 →
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {visibleMessages.map((msg, i) => {
          if (msg.kind === "transition") {
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 py-2">
                <div className="flex items-center gap-2 text-sm text-sky-600 font-medium">
                  <span className="h-px w-8 bg-sky-200" />
                  <span>🎈 새로운 이야기가 시작됐어요!</span>
                  <span className="h-px w-8 bg-sky-200" />
                </div>
                <div className="max-w-[80%] px-5 py-3 rounded-3xl bg-sky-100 border border-sky-200 text-gray-800">
                  <p className="text-sm text-sky-600 font-medium mb-1 inline-flex items-center gap-1.5">
                    {activeStep ? (
                      <>
                        <img src={`/avatars/${activeStep.aiAvatar}.png`} alt="" className="w-6 h-6 rounded-full object-cover" />
                        {activeStep.aiName}
                      </>
                    ) : "AI 친구"}
                  </p>
                  <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            );
          }
          return (
            <div key={i} className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-5 py-3 rounded-3xl ${
                msg.role === "student"
                  ? "bg-sky-500 text-white rounded-br-lg"
                  : "bg-white border border-sky-100 text-gray-800 rounded-bl-lg shadow-sm"
              }`}>
                {msg.role === "ai" && (
                  <p className="text-sm text-gray-400 font-medium mb-1 inline-flex items-center gap-1.5">
                    {activeStep ? (
                      <>
                        <img src={`/avatars/${activeStep.aiAvatar}.png`} alt="" className="w-6 h-6 rounded-full object-cover" />
                        {activeStep.aiName}
                      </>
                    ) : "AI 친구"}
                  </p>
                )}
                <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          );
        })}
        {allStepsCompleted && (
          <div className="flex justify-center py-4">
            <div className="px-6 py-3 bg-green-50 border-2 border-green-200 rounded-full text-base font-bold text-green-700">
              🎉 오늘 가르치기 대성공! 정말 멋진 선생님이에요 🏆
            </div>
          </div>
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-sky-100 px-5 py-3 rounded-3xl rounded-bl-lg shadow-sm">
              <p className="text-sm text-gray-400 font-medium mb-1">{currentStep?.aiName || "AI 친구"}</p>
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 bg-sky-300 rounded-full animate-bounce"></span>
                <span className="w-2.5 h-2.5 bg-sky-300 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                <span className="w-2.5 h-2.5 bg-sky-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {isViewingCurrent ? (
        <form onSubmit={sendMessage} className="p-4 border-t border-sky-100 bg-white rounded-t-2xl">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="AI 친구에게 설명해 주세요 ✏️"
              className="flex-1 px-5 py-3 text-base border-2 border-sky-200 rounded-full focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3 text-base font-bold bg-sky-500 text-white rounded-full hover:bg-sky-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              보내기
            </button>
          </div>
        </form>
      ) : (
        <div className="p-4 border-t border-sky-100 bg-white rounded-t-2xl text-center">
          <button
            onClick={() => currentStep && setActiveStepId(currentStep.id)}
            className="px-6 py-3 text-base font-bold bg-sky-500 text-white rounded-full hover:bg-sky-600 transition"
          >
            지금 이야기로 돌아가기 →
          </button>
        </div>
      )}
    </div>
  );
}
