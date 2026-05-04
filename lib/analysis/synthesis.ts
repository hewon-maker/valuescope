// Synthesis — 인터뷰 + 서베이 → 마인드맵 (compound 카테고리 + 다양한 엣지)
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

const Q_TYPE: Record<string, string> = {
  Q1: "survey_value",
  Q2: "survey_action_do",
  Q3: "survey_action_dont",
  Q4: "survey_action_more",
};

// 키워드 매칭으로 서베이 → 인터뷰 가치 연결 시도
const ALIGN_RULES: { pattern: RegExp; valueKeyword: string; type: "aligned_strong" | "aligned" | "weak"; weight: number }[] = [
  { pattern: /환자.*중심|환자.*경험|환자.*안전/, valueKeyword: "환자 중심", type: "aligned_strong", weight: 0.9 },
  { pattern: /변화|혁신|개선|미래|발전/, valueKeyword: "혁신 마인드", type: "aligned_strong", weight: 0.9 },
  { pattern: /시스템|효율|AI|디지털|자동화/, valueKeyword: "안전·시스템 사고", type: "aligned", weight: 0.7 },
  { pattern: /시스템|효율|AI|디지털|자동화/, valueKeyword: "혁신 마인드", type: "aligned", weight: 0.65 },
  { pattern: /소통|대화|커뮤/, valueKeyword: "원팀 협업", type: "aligned_strong", weight: 0.85 },
  { pattern: /소통.*협력|부서.*협력|협업.*강화/, valueKeyword: "원팀 협업", type: "aligned", weight: 0.85 },
  { pattern: /도움|협업|먼저/, valueKeyword: "원팀 협업", type: "aligned", weight: 0.75 },
  { pattern: /배려|존중|역지사지/, valueKeyword: "겸손한 전문성", type: "aligned", weight: 0.8 },
  { pattern: /쿠션어|부드|상냥|친절/, valueKeyword: "겸손한 전문성", type: "aligned", weight: 0.7 },
  { pattern: /인사|존댓말|존칭/, valueKeyword: "솔선수범 리더십", type: "aligned", weight: 0.75 },
  { pattern: /칭찬|감사|격려/, valueKeyword: "솔선수범 리더십", type: "aligned", weight: 0.7 },
  { pattern: /직장문화|화합/, valueKeyword: "조직 안정성", type: "aligned", weight: 0.65 },
  { pattern: /교육|연구|전문성/, valueKeyword: "교육·인재 양성", type: "aligned", weight: 0.7 },
  { pattern: /수평|평등|태움/, valueKeyword: "직군 간 벽 허물기", type: "aligned", weight: 0.75 },
  { pattern: /화|감정|짜증|한숨/, valueKeyword: "겸손한 전문성", type: "weak", weight: 0.4 },
  { pattern: /미루|회피/, valueKeyword: "원팀 협업", type: "weak", weight: 0.5 },
  { pattern: /독단|명령/, valueKeyword: "겸손한 전문성", type: "aligned", weight: 0.7 },
  { pattern: /오픈|의견|발언/, valueKeyword: "오픈·발언 분위기", type: "aligned", weight: 0.75 },
];

function colorForEmotion(emotion: string): string {
  if (emotion === "negative" || emotion === "concerned") return "#fb923c";
  return "#fb923c"; // 인터뷰 노드는 모두 주황 톤
}

export function buildMindmap(
  interviewData: InterviewAnalysis | null,
  surveyData: SurveyAnalysis | null,
  organization = "조직"
): MindmapData {
  const nodes: MindmapNode[] = [];
  const edges: MindmapEdge[] = [];

  // 1) 루트
  nodes.push({ data: { id: "center", label: `${organization}\n가치체계`, type: "root", size: 80, color: "#1f2937" } });

  // 2) 카테고리 (compound)
  for (const c of CATEGORIES) {
    nodes.push({ data: { id: c.id, label: c.label, type: "category", color: c.color } });
    edges.push({ data: { source: "center", target: c.id, type: "structure", weight: 1 } });
  }

  // 3) 인터뷰 핵심가치 → 카테고리에 소속
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

  let coherenceScores: number[] = [];
  let strongAligns = 0;
  let gaps = 0;
  let tensions = 0;

  for (const [keyword, cv] of interviewValues.entries()) {
    const parent = CAT_MAP[cv.category] || "cat_way";
    const id = `v_${slugify(keyword)}`;
    nodes.push({
      data: {
        id,
        parent,
        label: keyword,
        type: "central_value",
        weight: cv.importance,
        size: 50 + cv.importance * 25,
        color: colorForEmotion(cv.emotion),
        speakers: cv.speakers,
        subthemes: cv.subthemes,
        quotes: cv.quotes,
      },
    });
  }

  // 4) 서베이 개념 노드 + 정합 엣지
  const allValueIds = Array.from(interviewValues.keys());
  const valueIdLookup = new Map(allValueIds.map((k) => [k, `v_${slugify(k)}`]));

  const addSurveyConcepts = (concepts: SurveyConcept[] | undefined, q: string) => {
    if (!concepts) return;
    const top = concepts.slice(0, 8);
    const maxFreq = Math.max(...top.map((c) => c.frequency), 1);
    for (const c of top) {
      const id = `${q.toLowerCase()}_${slugify(c.keyword)}`;
      const sizeBase = q === "Q1" ? 45 : 28;
      const size = sizeBase + (c.frequency / maxFreq) * 25;
      nodes.push({
        data: {
          id,
          label: c.keyword,
          type: Q_TYPE[q],
          source: q,
          frequency: c.frequency,
          ratio: c.ratio ?? c.frequency / 144,
          rank: c.rank,
          size,
          color: Q_COLOR[q],
          summary: `${q} ${c.rank}위 — ${c.frequency}명`,
          sample_quote: c.quotes?.[0]?.text,
          by_dept: c.by_dept_group ? Object.entries(c.by_dept_group).map(([k, v]) => `${k} ${v}`).join(", ") : undefined,
        },
      });

      // 매칭으로 인터뷰 가치와 연결
      let connected = false;
      for (const rule of ALIGN_RULES) {
        if (!rule.pattern.test(c.keyword)) continue;
        const valueId = valueIdLookup.get(rule.valueKeyword);
        if (!valueId) continue;
        edges.push({
          data: {
            source: valueId,
            target: id,
            type: rule.type,
            weight: rule.weight,
            label: rule.type === "aligned_strong" ? "강한 정합" : rule.type === "aligned" ? "정합" : "약한 신호",
          },
        });
        if (rule.type === "aligned_strong") strongAligns++;
        coherenceScores.push(rule.weight);
        connected = true;
        break;
      }

      // 매칭 안 되면 카테고리(부모)와 약한 연결
      if (!connected) {
        let parent: string | null = null;
        if (q === "Q1") parent = "cat_aspire";
        else if (q === "Q4") parent = "cat_aspire";
        if (parent) {
          edges.push({
            data: { source: parent, target: id, type: "weak", weight: 0.4, label: "약한 신호" },
          });
        }
      }
    }
  };

  if (surveyData) {
    addSurveyConcepts(surveyData.q1_top_value?.concepts, "Q1");
    addSurveyConcepts(surveyData.q2_should_do?.concepts, "Q2");
    addSurveyConcepts(surveyData.q3_dont_do?.concepts, "Q3");
    addSurveyConcepts(surveyData.q4_more_needed?.concepts, "Q4");
  }

  // 5) 매핑 안 된 인터뷰 가치 → mass 부재 = 갭 후보
  const valueWithEdges = new Set(edges.filter((e) => valueIdLookup.has(e.data.source.replace("v_", "")) || valueIdLookup.has(e.data.target.replace("v_", ""))).flatMap((e) => [e.data.source, e.data.target]));
  for (const [keyword, valueId] of valueIdLookup.entries()) {
    const hasOutgoing = edges.some((e) => e.data.source === valueId || e.data.target === valueId);
    if (!hasOutgoing) {
      // 카테고리 가치인데 서베이에 반향 없음 — 잠재 갭
      gaps++;
    }
  }

  const overall = coherenceScores.length
    ? coherenceScores.reduce((a, b) => a + b, 0) / coherenceScores.length
    : 0;

  return {
    metadata: {
      organization,
      generated_for: "Cytoscape.js compound mindmap",
      data_source: `${interviewData ? `인터뷰 ${interviewData.interviews.length}건` : ""}${interviewData && surveyData ? " + " : ""}${surveyData ? `서베이 ${surveyData.metadata.total_responses}건` : ""}`,
      analyzed_at: new Date().toISOString().slice(0, 10),
      categories: CATEGORIES,
      edge_types: [
        { id: "aligned_strong", label: "강한 정합", color: "#10b981" },
        { id: "aligned", label: "정합", color: "#3b82f6" },
        { id: "weak", label: "약한 신호", color: "#6b7280" },
        { id: "gap", label: "갭", color: "#ef4444" },
        { id: "tension", label: "내적 긴장", color: "#f59e0b" },
      ],
      coherence_summary: {
        overall_score: +overall.toFixed(2),
        strong_alignments: strongAligns,
        gaps_detected: gaps,
        tensions_detected: tensions,
        interpretation: `자동 분석 — 정합도 ${(overall * 100).toFixed(0)}%, 강한 정합 ${strongAligns}건, 잠재 갭 ${gaps}건. 컨설턴트 검토·수정 권장.`,
      },
    },
    nodes,
    edges,
  };
}

function slugify(s: string): string {
  return s.replace(/[\s\/·.,]/g, "_").replace(/_+/g, "_");
}
