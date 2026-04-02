"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Message {
  role: string;
  content: string;
  createdAt?: string;
}

interface CourseInfo {
  name: string;
  subject: string;
  unit: string;
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
    setInput("");
    setMessages((prev) => [...prev, { role: "student", content: userMessage }]);
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
      setMessages((prev) => [...prev, { role: "ai", content: data.message }]);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500">AI 학생을 준비하고 있어요...</p>
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

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <div className="p-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/student")} className="text-gray-500 hover:text-gray-700">
            &larr;
          </button>
          <div>
            <h1 className="font-semibold">{courseInfo?.name || "AI 학생에게 가르치기"}</h1>
            <p className="text-xs text-gray-500">
              {courseInfo ? `${courseInfo.subject} · ${courseInfo.unit}` : "개념을 설명해주세요. AI 학생이 질문하고 배울 거예요!"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-sm px-4 py-2.5 rounded-2xl ${
              msg.role === "student"
                ? "bg-blue-600 text-white rounded-br-md"
                : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
            }`}>
              {msg.role === "ai" && <p className="text-xs text-gray-400 mb-1">AI 학생</p>}
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-2xl rounded-bl-md">
              <p className="text-xs text-gray-400 mb-1">AI 학생</p>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="AI 학생에게 설명해주세요..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            보내기
          </button>
        </div>
      </form>
    </div>
  );
}
