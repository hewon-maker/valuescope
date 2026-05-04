"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewProjectForm() {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { data, error } = await supabase
      .from("projects")
      .insert({ owner_id: user.id, name, client_name: client || null, description: desc || null })
      .select("id").single();
    setBusy(false);
    if (error) { alert(error.message); return; }
    if (data) router.push(`/projects/${data.id}`);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-ink-900 border border-dashed border-ink-700 hover:border-blue-500/60 rounded-lg p-5 text-left transition"
      >
        <div className="text-3xl text-blue-500 mb-2">+</div>
        <div className="text-sm font-bold text-white">새 프로젝트</div>
        <div className="text-xs text-gray-500 mt-1">클라이언트별 가치체계 분석 시작</div>
      </button>
    );
  }

  return (
    <form onSubmit={create} className="bg-ink-900 border border-blue-500/40 rounded-lg p-5 space-y-3 col-span-full md:col-span-3">
      <div className="text-sm font-bold text-white mb-2">새 프로젝트</div>
      <input
        required value={name} onChange={(e) => setName(e.target.value)}
        placeholder="프로젝트 이름 (예: 건대병원 가치체계 수립)"
        className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-2 text-sm text-white"
      />
      <input
        value={client} onChange={(e) => setClient(e.target.value)}
        placeholder="클라이언트 (예: 건국대학교병원)"
        className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-2 text-sm text-white"
      />
      <textarea
        value={desc} onChange={(e) => setDesc(e.target.value)}
        placeholder="설명 (선택)" rows={2}
        className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-2 text-sm text-white"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-md">
          {busy ? "생성 중..." : "생성"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="bg-ink-700 text-gray-300 text-sm px-4 py-2 rounded-md">취소</button>
      </div>
    </form>
  );
}
