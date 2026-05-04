import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { analyzeSurvey, inferColumns } from "@/lib/analysis/survey";
import { analyzeInterview, buildInterviewAnalysis } from "@/lib/analysis/interview";
import { buildMindmap } from "@/lib/analysis/synthesis";
import type { Interview, InterviewAnalysis, SurveyAnalysis } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { projectId } = await req.json();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 프로젝트 + 업로드 조회
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  const { data: uploads } = await supabase.from("uploads").select("*").eq("project_id", projectId);
  if (!uploads || uploads.length === 0) {
    return NextResponse.json({ error: "no uploads" }, { status: 400 });
  }

  // 분석 상태 → analyzing
  await supabase.from("analyses").upsert(
    { project_id: projectId, status: "analyzing", error_message: null },
    { onConflict: "project_id" }
  );

  try {
    const orgName = project.client_name || project.name;

    // 서베이 처리
    let surveyAnalysis: SurveyAnalysis | null = null;
    const surveyUploads = uploads.filter((u) => u.kind === "survey");
    if (surveyUploads.length > 0) {
      // 첫 서베이 파일만 처리 (Phase 1)
      const u = surveyUploads[0];
      const { data: file, error } = await supabase.storage.from("uploads").download(u.storage_path);
      if (error) throw new Error(`서베이 파일 다운로드 실패: ${error.message}`);
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const rows = parsed.data as any[];
      const headers = parsed.meta.fields ?? [];
      const hints = inferColumns(headers);
      surveyAnalysis = analyzeSurvey(rows, hints, orgName);
    }

    // 인터뷰 처리
    let interviewAnalysis: InterviewAnalysis | null = null;
    const interviewUploads = uploads.filter((u) => u.kind === "interview");
    if (interviewUploads.length > 0) {
      const interviews: Interview[] = [];
      for (const u of interviewUploads) {
        const { data: file, error } = await supabase.storage.from("uploads").download(u.storage_path);
        if (error) throw new Error(`인터뷰 파일 다운로드 실패: ${error.message}`);
        const text = await file.text();
        const { interview } = analyzeInterview(u.filename, text);
        interviews.push(interview);
      }
      interviewAnalysis = buildInterviewAnalysis(interviews, orgName);
    }

    // 마인드맵 합성
    const mindmap = buildMindmap(interviewAnalysis, surveyAnalysis, orgName);

    await supabase.from("analyses").upsert(
      {
        project_id: projectId,
        survey_json: surveyAnalysis,
        interview_json: interviewAnalysis,
        mindmap_json: mindmap,
        status: "ready",
        error_message: null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    );

    return NextResponse.json({ ok: true, mindmap });
  } catch (e: any) {
    await supabase.from("analyses").upsert(
      { project_id: projectId, status: "failed", error_message: e.message ?? String(e) },
      { onConflict: "project_id" }
    );
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
