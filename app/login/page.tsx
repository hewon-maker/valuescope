"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/projects");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("가입 메일을 확인해주세요. 인증 후 로그인 탭으로 돌아오시면 돼요.");
      }
    } catch (e: any) {
      setErr(e.message ?? "오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-ink-900 rounded-xl border border-ink-700 p-7">
        <div className="mb-6">
          <div className="text-2xl font-extrabold text-white">
            <span className="text-blue-500">Value</span>Scope
          </div>
          <div className="text-xs text-gray-500 mt-1">가치체계 인식 시각화 도구</div>
        </div>

        <div className="flex gap-1 mb-5 bg-ink-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
              mode === "signin" ? "bg-ink-700 text-white" : "text-gray-500"
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${
              mode === "signup" ? "bg-ink-700 text-white" : "text-gray-500"
            }`}
          >
            가입
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">비밀번호</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>
          {err && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-md px-3 py-2">{err}</div>}
          {msg && <div className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 rounded-md px-3 py-2">{msg}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-md transition"
          >
            {busy ? "처리 중..." : mode === "signin" ? "로그인" : "가입"}
          </button>
        </form>
      </div>
    </div>
  );
}
