// 서베이 CSV 자동 분석 — 정규식 기반 클러스터링
// 입력: parsed CSV rows ({컬럼명: 값})
// 출력: SurveyAnalysis JSON

import type { SurveyAnalysis, SurveyConcept } from "@/lib/supabase/types";

const Q2_PATTERNS: Record<string, RegExp[]> = {
  "소통/대화": [/소통/, /대화/, /의사소통/, /명확/, /전달/, /커뮤니케이션/, /피드백.*주/, /질문/, /표현/, /말하/],
  "인사/예절": [/인사/, /존댓말/, /존칭/, /목례/],
  "배려/존중": [/배려/, /존중/, /입장/, /역지사지/, /공감/, /이해/, /라포/],
  "도움/협업": [/도와/, /도움/, /먼저/, /협업/, /협조/, /챙겨/, /손내/, /손 내/],
  "칭찬/감사": [/감사/, /칭찬/, /격려/],
  "경청": [/경청/, /듣기/, /귀 ?기울/, /들어/],
  "표정/태도": [/밝/, /미소/, /웃/, /긍정/, /쾌활/],
  "쿠션어/말투": [/쿠션어/, /부드/, /상냥/, /친절/, /말투/, /어투/],
  "책임/정확": [/책임/, /정확/, /재확인/, /숙지/, /기록/, /신속/],
  "마인드 컨트롤": [/한 ?템포/, /참는다/, /감정.*조절/, /자제/],
};

const Q3_PATTERNS: Record<string, RegExp[]> = {
  "비속어/거친 말투": [/비속어/, /반말/, /인격모독/],
  "화/감정 폭발": [/한숨/, /짜증/, /화 ?내/, /언성/, /감정적/],
  "업무 회피·미루기": [/미루/, /떠넘/, /넘기/, /피하/, /회피/],
  "무시/외면": [/무시/, /무관심/, /무뚝뚝/, /폐쇄/],
  "뒷담화/험담": [/뒷담화/, /험담/, /흉보/, /뒷말/, /비난/],
  "책임 회피/남탓": [/남탓/, /책임 ?회피/, /핑계/, /변명/, /책임 ?전가/],
  "부정적 언어": [/부정/, /공격/, /단정/, /비꼬/],
  "독단/일방적": [/독단/, /명령/, /강요/, /강한 표현/],
  "지적/비판": [/지적/, /잘잘못/, /질책/],
};

const Q4_PATTERNS: Record<string, RegExp[]> = {
  "변화·혁신 추진": [/변화/, /혁신/, /발전/, /개선/, /개편/, /개혁/],
  "환자 중심 강화": [/환자.*중심/, /환자.*경험/, /환자.*안전/, /환자.*만족/, /환자 ?중심/],
  "인력·시설 보강": [/인력 ?충원/, /인력 ?증원/, /인력 ?보강/, /시설/, /장비/, /설비/, /인적자원/],
  "소통·협력 강화": [/소통/, /협업/, /협력/, /협조/, /의견.*수렴/, /부서간/],
  "교육·연구 강화": [/교육/, /연구/, /학습/, /훈련/, /전수/],
  "복지·처우 개선": [/복지/, /처우/, /보상/, /인센티브/, /휴게/, /근무환경/],
  "조직문화/존중 강화": [/존중/, /배려/, /화합/, /태움/, /수평/, /평등/, /애사심/],
  "시스템·효율화": [/시스템/, /효율/, /프로세스/, /\bAI\b/, /데이터/, /전산/, /자동화/, /디지털/],
};

export interface ColumnHints {
  dept?: string;
  q1?: string;
  q2?: string;
  q3?: string;
  q4?: string;
}

// 컬럼 자동 추측: 컬럼 이름에 키워드 포함 여부로
export function inferColumns(headers: string[]): ColumnHints {
  const out: ColumnHints = {};
  for (const h of headers) {
    const norm = h.replace(/^﻿/, "").trim();
    if (!out.dept && /부서|소속|팀|부문/.test(norm)) out.dept = norm;
    if (!out.q1 && /(Q1|핵심가치|중요한.*가치|가장 중요)/i.test(norm)) out.q1 = norm;
    if (!out.q2 && /(Q2|하려는|해야|일하는|행동.*하려)/i.test(norm)) out.q2 = norm;
    if (!out.q3 && /(Q3|하지 않|말아야|지양)/i.test(norm)) out.q3 = norm;
    if (!out.q4 && /(Q4|더 해야|발전|미래|건의|개선)/i.test(norm)) out.q4 = norm;
  }
  return out;
}

function deptGroup(d: string): string {
  if (!d) return "미상";
  if (/병동|ICU|신생아|VIP/.test(d)) return "병동/간호";
  if (/수술|마취|회복|분만/.test(d)) return "수술/시술";
  if (/영상|핵의학|진단검사/.test(d)) return "진단/영상";
  if (/약제|보험|원무|의료정보|건축/.test(d)) return "행정/지원";
  if (/재활|소화기|투석/.test(d)) return "진료/지원";
  if (/외래/.test(d)) return "외래";
  return "기타";
}

function classify(text: string, patterns: Record<string, RegExp[]>): string[] {
  if (!text) return [];
  const matched: string[] = [];
  for (const [cat, pats] of Object.entries(patterns)) {
    if (pats.some((p) => p.test(text))) matched.push(cat);
  }
  return matched;
}

interface Aggregate {
  count: Map<string, number>;
  quotes: Map<string, { text: string; dept: string }[]>;
  depts: Map<string, Map<string, number>>;
}

function newAgg(): Aggregate {
  return { count: new Map(), quotes: new Map(), depts: new Map() };
}

function bumpDept(agg: Aggregate, cat: string, dept: string) {
  if (!agg.depts.has(cat)) agg.depts.set(cat, new Map());
  const m = agg.depts.get(cat)!;
  m.set(dept, (m.get(dept) || 0) + 1);
}

function analyzeColumn(
  rows: any[],
  colKey: string | undefined,
  deptKey: string | undefined,
  patterns: Record<string, RegExp[]>
): Aggregate {
  const agg = newAgg();
  if (!colKey) return agg;
  for (const row of rows) {
    const text = (row[colKey] || "").trim();
    if (!text) continue;
    const dept = (deptKey ? row[deptKey] : "").trim();
    const cats = classify(text, patterns);
    if (cats.length === 0) {
      agg.count.set("기타", (agg.count.get("기타") || 0) + 1);
      continue;
    }
    for (const c of cats) {
      agg.count.set(c, (agg.count.get(c) || 0) + 1);
      bumpDept(agg, c, deptGroup(dept));
      const q = agg.quotes.get(c) || [];
      if (q.length < 5 && text.length < 140) q.push({ text, dept });
      agg.quotes.set(c, q);
    }
  }
  return agg;
}

function aggToConcepts(agg: Aggregate, prefix: string): SurveyConcept[] {
  const sorted = Array.from(agg.count.entries())
    .filter(([k]) => k !== "기타")
    .sort((a, b) => b[1] - a[1]);
  return sorted.map(([keyword, frequency], idx) => ({
    id: `${prefix}_${idx + 1}`,
    keyword,
    frequency,
    rank: idx + 1,
    quotes: (agg.quotes.get(keyword) || []).slice(0, 3),
    by_dept_group: Object.fromEntries(agg.depts.get(keyword) ?? new Map()),
  }));
}

export function analyzeSurvey(
  rows: any[],
  hints: ColumnHints,
  organization = "조직명 미상"
): SurveyAnalysis {
  const total = rows.length;

  // Q1: 단일선택 빈도
  const q1Counts = new Map<string, number>();
  const q1Depts = new Map<string, Map<string, number>>();
  if (hints.q1) {
    for (const r of rows) {
      const v = (r[hints.q1] || "").trim();
      if (!v) continue;
      q1Counts.set(v, (q1Counts.get(v) || 0) + 1);
      const dg = deptGroup(hints.dept ? r[hints.dept] : "");
      if (!q1Depts.has(v)) q1Depts.set(v, new Map());
      const m = q1Depts.get(v)!;
      m.set(dg, (m.get(dg) || 0) + 1);
    }
  }
  const q1Sorted = Array.from(q1Counts.entries()).sort((a, b) => b[1] - a[1]);
  const q1Concepts: SurveyConcept[] = q1Sorted.map(([keyword, frequency], idx) => ({
    id: `q1_${idx + 1}`,
    keyword,
    frequency,
    ratio: total > 0 ? +(frequency / total).toFixed(3) : 0,
    rank: idx + 1,
    by_dept_group: Object.fromEntries(q1Depts.get(keyword) ?? new Map()),
  }));

  const q2Agg = analyzeColumn(rows, hints.q2, hints.dept, Q2_PATTERNS);
  const q3Agg = analyzeColumn(rows, hints.q3, hints.dept, Q3_PATTERNS);
  const q4Agg = analyzeColumn(rows, hints.q4, hints.dept, Q4_PATTERNS);

  // 부서 분포 집계
  const deptGroups = new Map<string, number>();
  if (hints.dept) {
    for (const r of rows) {
      const g = deptGroup((r[hints.dept] || "").trim());
      deptGroups.set(g, (deptGroups.get(g) || 0) + 1);
    }
  }
  const uniqueDepts = new Set(rows.map(r => (hints.dept ? r[hints.dept] : "").trim()).filter(Boolean));

  return {
    metadata: {
      organization,
      total_responses: total,
      department_count: uniqueDepts.size,
      questions: 4,
      analyzed_at: new Date().toISOString().slice(0, 10),
      department_groups: Object.fromEntries(deptGroups),
    },
    q1_top_value: hints.q1
      ? { label: "Q1. 가장 중요한 핵심가치", concepts: q1Concepts }
      : undefined,
    q2_should_do: hints.q2
      ? { label: "Q2. 원활하게 일하기 위해 하려는 행동", concepts: aggToConcepts(q2Agg, "q2") }
      : undefined,
    q3_dont_do: hints.q3
      ? { label: "Q3. 원활하게 일하기 위해 하지 않으려는 행동", concepts: aggToConcepts(q3Agg, "q3") }
      : undefined,
    q4_more_needed: hints.q4
      ? { label: "Q4. 더 해야 할 행동", concepts: aggToConcepts(q4Agg, "q4") }
      : undefined,
  };
}
