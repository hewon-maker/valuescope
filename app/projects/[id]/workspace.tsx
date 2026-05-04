"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MindmapViewer from "@/components/MindmapViewer";
import type { UploadRow, AnalysisRow } from "@/lib/supabase/types";

export default function ProjectWorkspace({
  projectId, initialUploads, initialAnalysis,
}: {
  projectId: string;
  initialUploads: UploadRow[];
  initialAnalysis: AnalysisRow | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [uploads, setUploads] = useState(initialUploads);
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"upload" | "viz">(initialAnalysis?.mindmap_json ? "viz" : "upload");

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>, kind: "survey" | "interview") => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true); setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }

    try {
      const newRows: UploadRow[] = [];
      for (const file of Array.from(files)) {
        const dot = file.name.lastIndexOf(".");
        const ext = dot >= 0 ? file.name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
        const safeName = (dot >= 0 ? file.name.slice(0, dot) : file.name)
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 80) || "file";
        const path = `${user.id}/${projectId}/${kind}/${Date.now()}_${safeName}${ext}`;
        const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: row, error: insErr } = await supabase.from("uploads").insert({
          project_id: projectId, kind, filename: file.name, storage_path: path, size_bytes: file.size,
        }).select("*").single();
        if (insErr) throw insErr;
        if (row) newRows.push(row as UploadRow);
      }
      setUploads([...newRows, ...uploads]);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const removeUpload = async (u: UploadRow) => {
    if (!confirm(`${u.filename} 삭제할까요?`)) return;
    await supabase.storage.from("uploads").remove([u.storage_path]);
    await supabase.from("uploads").delete().eq("id", u.id);
    setUploads(uploads.filter((x) => x.id !== u.id));
  };

  const runAnalysis = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      // 서버에서 저장된 결과를 다시 읽어옴
      const { data: a } = await supabase.from("analyses").select("*").eq("project_id", projectId).single();
      setAnalysis(a as AnalysisRow);
      setTab("viz");
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const surveyCount = uploads.filter((u) => u.kind === "survey").length;
  const interviewCount = uploads.filter((u) => u.kind === "interview").length;
  const canAnalyze = surveyCount + interviewCount > 0 && !busy;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-2 border-b border-ink-700 bg-ink-900 flex items-center gap-2">
        <button onClick={() => setTab("upload")}
          className={`px-3 py-1.5 text-xs font-semibold rounded ${tab === "upload" ? "bg-ink-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
          1. 데이터 업로드
        </button>
        <button onClick={() => setTab("viz")} disabled={!analysis?.mindmap_json}
          className={`px-3 py-1.5 text-xs font-semibold rounded ${tab === "viz" ? "bg-ink-700 text-white" : "text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"}`}>
          2. 마인드맵
        </button>
        <div className="flex-1" />
        {analysis?.status === "ready" && <span className="text-[10px] text-emerald-400">분석 완료</span>}
        {analysis?.status === "analyzing" && <span className="text-[10px] text-amber-400">분석 중...</span>}
        {analysis?.status === "failed" && <span className="text-[10px] text-red-400">분석 실패</span>}
      </div>

      {tab === "upload" && (
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">데이터 업로드</h2>
              <p className="text-xs text-gray-500">서베이는 .csv, 인터뷰는 .md 파일을 올려주세요. 여러 파일 동시 업로드 가능해요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UploadCard
                title="구성원 서베이"
                desc="응답 종합 .csv"
                accept=".csv,text/csv"
                count={surveyCount}
                color="purple"
                onChange={(e) => onUpload(e, "survey")}
                disabled={busy}
              />
              <UploadCard
                title="경영진 인터뷰"
                desc="발화록 .md (여러 개 OK)"
                accept=".md,.markdown,text/markdown,text/plain"
                count={interviewCount}
                color="orange"
                multiple
                onChange={(e) => onUpload(e, "interview")}
                disabled={busy}
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-md px-3 py-2">{error}</div>
            )}

            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-600 font-bold mb-2">업로드된 파일 ({uploads.length})</h3>
              {uploads.length === 0 ? (
                <div className="text-center text-gray-600 text-sm py-8 bg-ink-900 rounded-lg border border-ink-700 border-dashed">
                  아직 업로드된 파일이 없어요.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {uploads.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 bg-ink-900 border border-ink-700 rounded-md px-3 py-2 text-xs">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${u.kind === "survey" ? "bg-purple-950/50 text-purple-300" : "bg-orange-950/50 text-orange-300"}`}>
                        {u.kind === "survey" ? "서베이" : "인터뷰"}
                      </span>
                      <span className="flex-1 text-gray-300 truncate">{u.filename}</span>
                      <span className="text-gray-600">{((u.size_bytes ?? 0) / 1024).toFixed(1)} KB</span>
                      <button onClick={() => removeUpload(u)} className="text-gray-500 hover:text-red-400">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-ink-700">
              <button onClick={runAnalysis} disabled={!canAnalyze}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-md text-sm">
                {busy ? "분석 중..." : analysis?.mindmap_json ? "다시 분석" : "분석 시작"}
              </button>
              <span className="text-[11px] text-gray-500 ml-3">
                자동 분석 (정규식 기반). 결과는 마인드맵 탭에서 확인하고, 필요시 수동 보정 가능해요.
              </span>
            </div>
          </div>
        </div>
      )}

      {tab === "viz" && analysis?.mindmap_json && (
        <div className="flex-1 min-h-0">
          <MindmapViewer data={analysis.mindmap_json as any} />
        </div>
      )}
      {tab === "viz" && !analysis?.mindmap_json && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          분석을 먼저 실행해주세요.
        </div>
      )}
    </div>
  );
}

function UploadCard({ title, desc, accept, count, color, onChange, multiple, disabled }: {
  title: string; desc: string; accept: string; count: number; color: "purple" | "orange";
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; multiple?: boolean; disabled?: boolean;
}) {
  const colorCls = color === "purple"
    ? "border-purple-700/60 hover:border-purple-500 bg-purple-950/10"
    : "border-orange-700/60 hover:border-orange-500 bg-orange-950/10";
  return (
    <label className={`block border-2 border-dashed ${colorCls} rounded-lg p-5 cursor-pointer transition ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
      <input type="file" accept={accept} onChange={onChange} multiple={multiple} disabled={disabled} className="hidden" />
      <div className="text-sm font-bold text-white">{title}</div>
      <div className="text-[11px] text-gray-400 mt-1">{desc}</div>
      <div className="mt-3 text-[11px] text-gray-500">
        {count > 0 ? `${count}개 업로드됨 · 클릭하여 추가` : "클릭 또는 파일 드래그"}
      </div>
    </label>
  );
}
