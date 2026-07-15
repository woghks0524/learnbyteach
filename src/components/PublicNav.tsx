import Link from "next/link";

// 소개·사용법 등 공개 페이지 공통 상단바
export default function PublicNav({ active }: { active?: "about" | "guide" }) {
  const link = (href: string, label: string, key: "about" | "guide") => (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
        active === key ? "bg-white text-sky-600 shadow-sm" : "text-gray-500 hover:text-sky-600"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-20 bg-sky-50/80 backdrop-blur border-b border-sky-100">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src="/avatars/default.png" alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm" />
          <span className="font-extrabold text-gray-800">가르치며 배우기</span>
        </Link>
        <div className="flex items-center gap-1">
          {link("/about", "소개", "about")}
          {link("/guide", "사용법", "guide")}
          <Link
            href="/login"
            className="ml-1 px-4 py-1.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-sky-400 to-indigo-400 hover:from-sky-500 hover:to-indigo-500 transition shadow-sm"
          >
            들어가기 🚀
          </Link>
        </div>
      </div>
    </nav>
  );
}
