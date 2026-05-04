import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProjectWorkspace from "./workspace";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) notFound();

  const { data: uploads } = await supabase
    .from("uploads")
    .select("*")
    .eq("project_id", params.id)
    .order("uploaded_at", { ascending: false });

  const { data: analysis } = await supabase
    .from("analyses")
    .select("*")
    .eq("project_id", params.id)
    .maybeSingle();

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 py-4 border-b border-ink-700 flex items-center gap-4">
        <Link href="/projects" className="text-xs text-gray-500 hover:text-white">← 목록</Link>
        <div className="flex-1">
          <div className="text-base font-bold text-white">{project.name}</div>
          {project.client_name && <div className="text-xs text-gray-500">{project.client_name}</div>}
        </div>
      </header>
      <ProjectWorkspace
        projectId={project.id}
        initialUploads={uploads ?? []}
        initialAnalysis={analysis ?? null}
      />
    </main>
  );
}
