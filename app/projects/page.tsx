import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NewProjectForm from "./new-project-form";
import LogoutButton from "./logout-button";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: projects } = await supabase
    .from("projects")
    .select("*, analyses(status)")
    .order("updated_at", { ascending: false });

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <header className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs text-gray-500 mb-1">{user?.email}</div>
          <h1 className="text-2xl font-extrabold text-white">
            <span className="text-blue-500">Value</span>Scope
          </h1>
          <p className="text-sm text-gray-500 mt-1">컨설팅 프로젝트 — 클라이언트별 가치체계 분석</p>
        </div>
        <LogoutButton />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <NewProjectForm />
      </div>

      <h2 className="text-xs uppercase tracking-wider text-gray-600 font-bold mb-3">내 프로젝트 ({projects?.length ?? 0})</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(projects ?? []).map((p: any) => {
          const status = p.analyses?.[0]?.status as string | undefined;
          const statusColor = {
            ready: "text-emerald-400 bg-emerald-950/40 border-emerald-900/60",
            analyzing: "text-amber-400 bg-amber-950/40 border-amber-900/60",
            failed: "text-red-400 bg-red-950/40 border-red-900/60",
            pending: "text-gray-500 bg-ink-800 border-ink-700",
          }[status ?? "pending"] ?? "text-gray-500 bg-ink-800 border-ink-700";
          const statusLabel = {
            ready: "분석 완료", analyzing: "분석 중", failed: "분석 실패", pending: "업로드 대기",
          }[status ?? "pending"] ?? "업로드 대기";
          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="block bg-ink-900 border border-ink-700 rounded-lg p-5 hover:border-blue-500/50 transition"
            >
              <div className="text-base font-bold text-white mb-1">{p.name}</div>
              {p.client_name && <div className="text-xs text-gray-500 mb-3">{p.client_name}</div>}
              {p.description && <div className="text-xs text-gray-400 mb-3 line-clamp-2">{p.description}</div>}
              <div className="flex items-center justify-between mt-4">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>
                  {statusLabel}
                </span>
                <span className="text-[10px] text-gray-600">
                  {new Date(p.updated_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </Link>
          );
        })}
        {(projects?.length ?? 0) === 0 && (
          <div className="col-span-full text-center text-gray-600 text-sm py-12">
            아직 프로젝트가 없어요. 좌측에서 새 프로젝트를 만들어보세요.
          </div>
        )}
      </div>
    </main>
  );
}
