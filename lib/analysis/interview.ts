// 인터뷰 MD 자동 분석 (LLM 없이 키워드 빈도 + 인용구 후보까지)
// 컨설턴트가 이후 수동으로 핵심가치 재정리하는 베이스라인
import type { InterviewAnalysis, CoreValue, Interview } from "@/lib/supabase/types";

// 가치 후보 사전 — 한국 의료 컨설팅 도메인
const VALUE_DICT: { keyword: string; category: string; patterns: RegExp[] }[] = [
  { keyword: "환자 중심", category: "최종 목적", patterns: [/환자.*중심/, /환자.*경험/, /환자.*안전/, /환자.*만족/] },
  { keyword: "원팀 협업", category: "일하는 방식", patterns: [/원팀/, /벽.*허물/, /부서.*협업/, /협조/] },
  { keyword: "한 방향 정렬", category: "일하는 방식", patterns: [/한 ?방향/, /정렬/, /한.*뜻/] },
  { keyword: "솔선수범 리더십", category: "일하는 방식", patterns: [/솔선수범/, /먼저.*인사/, /리더.*보이/] },
  { keyword: "안전·시스템 사고", category: "일하는 방식", patterns: [/시스템.*사고/, /블레임/, /사각지대/, /시스템적/] },
  { keyword: "직군 간 벽 허물기", category: "일하는 방식", patterns: [/우월의식/, /무시.*잔재/, /직군.*벽/] },
  { keyword: "위기 극복력", category: "조직 정체성", patterns: [/위기.*극복/, /의정사태/, /코로나.*극복/, /빨리.*극복/] },
  { keyword: "조직 안정성", category: "조직 정체성", patterns: [/조직.*안정/, /노사.*안정/, /흔들리지 않/, /적자/] },
  { keyword: "병원다움", category: "조직 정체성", patterns: [/병원답/, /사회적 역할/, /훌륭한 병원/] },
  { keyword: "혁신 마인드", category: "지향 가치", patterns: [/혁신/, /쇄신/, /패러다임 전환/] },
  { keyword: "교육·인재 양성", category: "지향 가치", patterns: [/교육.*인재/, /인재 양성/, /교육연구/, /연구.*투자/] },
  { keyword: "예방·헬스케어", category: "지향 가치", patterns: [/예방/, /프리벤션/, /헬스케어/, /건강한 사람/] },
  { keyword: "겸손한 전문성", category: "핵심인재상", patterns: [/겸손/, /오만/, /인커리지/] },
  { keyword: "성장·세컨맨", category: "핵심인재상", patterns: [/세컨맨/, /2세대/, /후계/, /넥스트/] },
  { keyword: "오픈·발언 분위기", category: "일하는 방식", patterns: [/해봤자/, /오픈.*분위기/, /의견.*반영/] },
];

const SPEAKER_PATTERN = /(^|\n)\s*(?:#+\s*)?([가-힣]{2,5})\s+([가-힣]+(?:원장|부원장|이사장|실장|팀장|본부장))(?=\s|$|\n)/g;

function pickQuotes(text: string, patterns: RegExp[], limit = 3): string[] {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 15 && s.length < 220);
  const matched: string[] = [];
  for (const s of sentences) {
    if (patterns.some((p) => p.test(s))) matched.push(s);
    if (matched.length >= limit) break;
  }
  return matched;
}

function detectImportance(text: string, patterns: RegExp[]): number {
  const matchCount = patterns.reduce((acc, p) => {
    const m = text.match(new RegExp(p.source, "g"));
    return acc + (m ? m.length : 0);
  }, 0);
  // 빈도 → 0.4 ~ 1.0 사이로 정규화
  if (matchCount === 0) return 0;
  if (matchCount >= 5) return 1.0;
  return 0.4 + (matchCount / 5) * 0.6;
}

export function analyzeInterview(
  filename: string,
  text: string,
  speakerHint?: string
): { interview: Interview; speakerDetected: string } {
  // 발화자 추측: 1) hint, 2) 파일명, 3) 본문 첫 100줄에서 자동
  let speaker = speakerHint || "";
  if (!speaker) {
    const fnMatch = filename.match(/([가-힣]{2,4})\s+([가-힣]+(?:원장|부원장|이사장|실장|팀장|본부장))/);
    if (fnMatch) speaker = `${fnMatch[1]} ${fnMatch[2]}`;
  }
  if (!speaker) {
    SPEAKER_PATTERN.lastIndex = 0;
    const m = SPEAKER_PATTERN.exec(text.slice(0, 500));
    if (m) speaker = `${m[2]} ${m[3]}`;
  }
  if (!speaker) speaker = filename.replace(/\.md$/i, "");

  const core_values: CoreValue[] = [];
  for (const v of VALUE_DICT) {
    const importance = detectImportance(text, v.patterns);
    if (importance < 0.4) continue;
    const quotes = pickQuotes(text, v.patterns, 3);
    if (quotes.length === 0) continue;
    core_values.push({
      keyword: v.keyword,
      category: v.category,
      importance: +importance.toFixed(2),
      emotion: "positive",
      context: `자동 추출 (정규식 매칭 ${quotes.length}건)`,
      subthemes: [],
      quotes,
    });
  }

  // 짧은 인용구 — raw_excerpts 후보
  const raw_excerpts = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 30 && l.length < 180)
    .slice(0, 6);

  return {
    interview: {
      id: filename,
      speaker,
      role: "자동 추출",
      tone: "자동 분석 베이스라인",
      core_values: core_values.sort((a, b) => b.importance - a.importance),
      raw_excerpts,
    },
    speakerDetected: speaker,
  };
}

export function buildInterviewAnalysis(
  interviews: Interview[],
  organization = "조직명 미상"
): InterviewAnalysis {
  return {
    metadata: {
      organization,
      interview_count: interviews.length,
      speakers: interviews.map((i) => i.speaker),
      analyzed_at: new Date().toISOString().slice(0, 10),
    },
    interviews,
  };
}
