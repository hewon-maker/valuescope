// Synthesis — 인터뷰 + 서베이 통합 마인드맵
// 핵심: 같은 개념은 하나의 노드로 병합하여 출처(경영진/구성원) 비교가 한눈에 보이게.

import type {
  InterviewAnalysis,
  SurveyAnalysis,
  MindmapData,
  MindmapNode,
  MindmapEdge,
  CoreValue,
  SurveyConcept,
} from "@/lib/supabase/types";

const CATEGORIES = [
  { id: "cat_purpose", label: "최종 목적", color: "#dc2626" },
  { id: "cat_identity", label: "조직 정체성", color: "#ea580c" },
  { id: "cat_way", label: "일하는 방식", color: "#0891b2" },
  { id: "cat_aspire", label: "지향 가치", color: "#7c3aed" },
  { id: "cat_talent", label: "핵심인재상", color: "#059669" },
];

const CAT_MAP: Record<string, string> = {
  "최종 목적": "cat_purpose",
  "조직 정체성": "cat_identity",
  "일하는 방식": "cat_way",
  "지향 가치": "cat_aspire",
  "핵심인재상": "cat_talent",
};

const Q_COLOR: Record<string, string> = {
  Q1: "#a78bfa",
  Q2: "#86efac",
  Q3: "#fda4af",
  Q4: "#c084fc",
};

const Q_LABEL: Record<string, string> = {
  Q1: "지향 가치",
  Q2: "해야 할 행동",
  Q3: "하지 말 것",
  Q4: "더 해야 할 것",
};

const Q_TYPE: Record<string, string> = {
  Q1: "survey_value",
  Q2: "survey_action_do",
  Q3: "survey_action_dont",
  Q4: "survey_action_more",
};

// 서베이 개념 → 인터뷰 핵심가치 매칭 룰 (정규식)
const ALIGN_RULES: { pattern: RegExp; valueKeyword: string; weight: number }[] = [
  { pattern: /환자.*중심|환자.*경험|환자.*안전/, valueKeyword: "환자 중심", weight: 0.9 },
  { pattern: /변화|혁신|개선|미래|발전/, valueKeyword: "혁신 마인드", weight: 0.9 },
  { pattern: /시스템|효율|AI|디지털|자동화/, valueKeyword: "안전·시스템 사고", weight: 0.7 },
  { pattern: /시스템|효율|AI|디지털|자동화/, valueKeyword: "혁신 마인드", weight: 0.65 },
  { pattern: /소통|대화|커뮤/, valueKeyword: "원팀 협업", weight: 0.85 },
  { pattern: /소통.*협력|부서.*협력|협업.*강화/, valueKeyword: "원팀 협업", weight: 0.85 },
  { pattern: /도움|협업|먼저/, valueKeyword: "원팀 협업", weight: 0.75 },
  { pattern: /배려|존중|역지사지/, valueKeyword: "겸손한 전문성", weight: 0.8 },
  { pattern: /쿠션어|부드|상냥|친절/, valueKeyword: "겸손한 전문성", weight: 0.7 },
  { pattern: /인사|존댓말|존칭/, valueKeyword: "솔선수범 리더십", weight: 0.75 },
  { pattern: /칭찬|감사|격려/, valueKeyword: "솔선수범 리더십", weight: 0.7 },
  { pattern: /직장문화|화합/, valueKeyword: "조직 안정성", weight: 0.65 },
  { pattern: /교육|연구|전문성/, valueKeyword: "교육·인재 양성", weight: 0.7 },
  { pattern: /수평|평등|태움/, valueKeyword: "직군 간 벽 허물기", weight: 0.75 },
  { pattern: /화|감정|짜증|한숨/, valueKeyword: "겸손한 전문성", weight: 0.4 },
  { pattern: /미루|회피/, valueKeyword: "원팀 협업", weight: 0.5 },
  { pattern: /독단|명령/, valueKeyword: "겸손한 전문성", weight: 0.7 },
  { pattern: /오픈|의견|발언/, valueKeyword: "오픈·발언 분위기", weight: 0.75 },
];

// 서베이 → 매칭되지 않은 개념의 카테고리 추론 (Q별 기본값)
const Q_FALLBACK_CAT: Record<string, string> = {
  Q1: "cat_aspire",
  Q2: "cat_way",
  Q3: "cat_way",
  Q4: "cat_aspire",
};

interface SurveyMatch {
  q: string;          // Q1 ~ Q4
  q_label: string;    // 지향 가치 / 해야 할 행동 / ...
  keyword: string;
  rank: number;
  frequency: number;
  ratio: number;
  sample_quote?: string;
  by_dept?: string;
  match_weight: number;
}

export function buildMindmap(
  interviewData: InterviewAnalysis | null,
  surveyData: SurveyAnalysis | null,
  organization = "조직"
): MindmapData {
  const nodes: MindmapNode[] = [];
  const edges: MindmapEdge[] = [];
  const totalResponses = surveyData?.metadata.total_responses ?? 144;

  // 1) 루트
  nodes.push({ data: { id: "center", label: `${organization}\n가치체계`, type: "root", size: 80, color: "#1f2937" } });

  // 2) 카테고리 (compound parent로 사용)
  for (const c of CATEGORIES) {
    nodes.push({ data: { id: c.id, label: c.label, type: "category", color: c.color } });
    edges.push({ data: { source: "center", target: c.id, type: "structure", weight: 1 } });
  }

  // 3) 인터뷰 핵심가치 집계
  const interviewValues = new Map<string, CoreValue & { speakers: string[] }>();
  if (interviewData) {
    for (const iv of interviewData.interviews) {
      for (const cv of iv.core_values) {
        const existing = interviewValues.get(cv.keyword);
        if (existing) {
          existing.quotes = [...existing.quotes, ...cv.quotes].slice(0, 6);
          existing.importance = Math.max(existing.importance, cv.importance);
          if (!existing.speakers.includes(iv.speaker)) existing.speakers.push(iv.speaker);
        } else {
          interviewValues.set(cv.keyword, { ...cv, speakers: [iv.speaker] });
        }
      }
    }
  }

  // 4) 각 인터뷰 가치의 survey_matches 누적용 맵
  const surveyMatchesByValue = new Map<string, SurveyMatch[]>();
  for (const k of interviewValues.keys()) surveyMatchesByValue.set(k, []);

  // 5) 서베이 개념 처리: 매칭되면 인터뷰 가치에 합치고, 아니면 standalone 후보로
  type StandaloneCandidate = { q: string; concept: SurveyConcept };
  const standalone: StandaloneCandidate[] = [];

  const processQ = (concepts: SurveyConcept[] | undefined, q: string, limit: number) => {
    if (!concepts) return;
    const top = concepts.slice(0, limit);
    for (const c of top) {
      // 매칭 룰 시도
      let matchedKey: string | null = null;
      let matchWeight = 0;
      for (const rule of ALIGN_RULES) {
        if (!rule.pattern.test(c.keyword)) continue;
        if (interviewValues.has(rule.valueKeyword)) {
          matchedKey = rule.valueKeyword;
          matchWeight = rule.weight;
          break;
        }
      }
      if (matchedKey) {
        const ratio = c.ratio ?? c.frequency / totalResponses;
        const by_dept = c.by_dept_group
          ? Object.entries(c.by_dept_group).map(([k, v]) => `${k} ${v}`).join(", ")
          : undefined;
        surveyMatchesByValue.get(matchedKey)!.push({
          q,
          q_label: Q_LABEL[q],
          keyword: c.keyword,
          rank: c.rank,
          frequency: c.frequency,
          ratio,
          sample_quote: c.quotes?.[0]?.text,
          by_dept,
          match_weight: matchWeight,
        });
      } else {
        standalone.push({ q, concept: c });
      }
    }
  };

  if (surveyData) {
    processQ(surveyData.q1_top_value?.concepts, "Q1", 6);
    processQ(surveyData.q2_should_do?.concepts, "Q2", 4);
    processQ(surveyData.q3_dont_do?.concepts, "Q3", 4);
    processQ(surveyData.q4_more_needed?.concepts, "Q4", 4);
  }

  // 6) 정합도 / 갭 / 강한정합 카운트
  let strongAligns = 0;
  let gaps = 0;
  let alignmentScores: number[] = [];

  // 7) 노드 생성: 인터뷰 가치 (병합)
  for (const [keyword, cv] of interviewValues.entries()) {
    const id = `v_${slugify(keyword)}`;
    const matches = surveyMatchesByValue.get(keyword) ?? [];
    const sources = ["interview", ...new Set(matches.map((m) => m.q))];
    const has_survey = matches.length > 0;
    const has_gap = !has_survey;
    if (has_gap) gaps++;
    if (has_survey) {
      const top = matches.reduce((a, b) => (b.match_weight > a.match_weight ? b : a));
      if (top.match_weight >= 0.85) strongAligns++;
      alignmentScores.push(top.match_weight);
    }

    nodes.push({
      data: {
        id,
        parent: CAT_MAP[cv.category] || "cat_way",
        label: keyword,
        type: "central_value",
        sources,
        is_aligned: has_survey,
        has_gap,
        // 인터뷰 측
        speakers: cv.speakers,
        subthemes: cv.subthemes,
        quotes: cv.quotes,
        importance: cv.importance,
        emotion: cv.emotion,
        // 서베이 매칭들
        survey_matches: matches,
        // 시각
        weight: cv.importance,
        size: 55 + cv.importance * 25 + (has_survey ? 8 : 0),
        color: "#fb923c", // 인터뷰 베이스 색
      },
    });
  }

  // 8) Standalone 서베이 노드 (매칭 안 됨 — 구성원 단독 신호)
  // 같은 키워드가 여러 Q에서 등장할 수 있으니 dedup
  const dedup = new Map<string, StandaloneCandidate>();
  for (const s of standalone) {
    const key = `${s.q}::${s.concept.keyword}`;
    if (!dedup.has(key)) dedup.set(key, s);
  }
  for (const { q, concept: c } of dedup.values()) {
    const id = `${q.toLowerCase()}_${slugify(c.keyword)}`;
    const ratio = c.ratio ?? c.frequency / totalResponses;
    const by_dept = c.by_dept_group
      ? Object.entries(c.by_dept_group).map(([k, v]) => `${k} ${v}`).join(", ")
      : undefined;
    const sizeBase = q === "Q1" ? 45 : 32;
    const maxFreqInQ = Math.max(
      1,
      ...standalone.filter((x) => x.q === q).map((x) => x.concept.frequency)
    );
    const size = sizeBase + (c.frequency / maxFreqInQ) * 22;
    nodes.push({
      data: {
        id,
        parent: Q_FALLBACK_CAT[q] ?? "cat_way",
        label: c.keyword,
        type: Q_TYPE[q],
        sources: [q],
        is_aligned: false,
        has_gap: false,            // 서베이 단독은 갭이 아니라 "구성원 단독 신호"
        survey_only: true,
        // 서베이 측
        survey_matches: [
          {
            q,
            q_label: Q_LABEL[q],
            keyword: c.keyword,
            rank: c.rank,
            frequency: c.frequency,
            ratio,
            sample_quote: c.quotes?.[0]?.text,
            by_dept,
            match_weight: 0,
          } as SurveyMatch,
        ],
        // 호환용 (기존 panel 필드)
        source: q,
        frequency: c.frequency,
        ratio,
        rank: c.rank,
        sample_quote: c.quotes?.[0]?.text,
        by_dept,
        // 시각
        size,
        color: Q_COLOR[q],
      },
    });
  }

  // 9) coherence summary
  const overall = alignmentScores.length
    ? alignmentScores.reduce((a, b) => a + b, 0) / alignmentScores.length
    : 0;
  const interviewCount = interviewValues.size;
  const surveyOnlyCount = dedup.size;

  return {
    metadata: {
      organization,
      generated_for: "Cytoscape.js compound mindmap",
      data_source: `${interviewData ? `인터뷰 ${interviewData.interviews.length}건` : ""}${interviewData && surveyData ? " + " : ""}${surveyData ? `서베이 ${surveyData.metadata.total_responses}건` : ""}`,
      analyzed_at: new Date().toISOString().slice(0, 10),
      categories: CATEGORIES,
      // 매핑 통계 (UI 헤더에 사용)
      stats: {
        interview_values: interviewCount,
        aligned: interviewCount - gaps,
        gaps,
        survey_only: surveyOnlyCount,
      },
      coherence_summary: {
        overall_score: +overall.toFixed(2),
        strong_alignments: strongAligns,
        gaps_detected: gaps,
        tensions_detected: 0,
        interpretation: `경영진 가치 ${interviewCount}개 중 ${interviewCount - gaps}개가 구성원 응답에서 반향됨 (${interviewCount > 0 ? (((interviewCount - gaps) / interviewCount) * 100).toFixed(0) : 0}%). 갭 ${gaps}건, 구성원 단독 신호 ${surveyOnlyCount}건.`,
      },
    },
    nodes,
    edges,
  };
}

function slugify(s: string): string {
  return s.replace(/[\s\/·.,]/g, "_").replace(/_+/g, "_");
}
