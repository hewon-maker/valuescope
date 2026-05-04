// 분석 결과 JSON 타입 — 기존 outputs/*.json 구조와 동일

export type Emotion = "positive" | "negative" | "neutral" | "mixed" | "urgent" | "concerned" | "exploratory";

export interface InterviewQuote { text: string; }

export interface CoreValue {
  keyword: string;
  category: string;
  importance: number;
  emotion: Emotion;
  context: string;
  subthemes: string[];
  quotes: string[];
}

export interface Interview {
  id: string;
  speaker: string;
  role?: string;
  date?: string;
  tone?: string;
  core_values: CoreValue[];
  raw_excerpts?: string[];
}

export interface InterviewAnalysis {
  metadata: {
    organization: string;
    interview_count: number;
    speakers: string[];
    interview_dates?: string[];
    analyzed_at: string;
  };
  interviews: Interview[];
  synthesis?: any;
}

export interface SurveyConcept {
  id: string;
  keyword: string;
  frequency: number;
  ratio?: number;
  rank: number;
  subthemes?: string[];
  by_dept_group?: Record<string, number>;
  quotes?: { text: string; dept: string }[];
}

export interface SurveyAnalysis {
  metadata: {
    organization: string;
    total_responses: number;
    department_count: number;
    questions: number;
    analyzed_at: string;
    department_groups?: Record<string, number>;
  };
  q1_top_value?: { label: string; concepts: SurveyConcept[]; interpretation?: string };
  q2_should_do?: { label: string; concepts: SurveyConcept[]; interpretation?: string };
  q3_dont_do?: { label: string; concepts: SurveyConcept[]; interpretation?: string };
  q4_more_needed?: { label: string; concepts: SurveyConcept[]; interpretation?: string };
}

export interface MindmapNode {
  data: {
    id: string;
    label: string;
    type: string;
    parent?: string;
    color?: string;
    size?: number;
    weight?: number;
    [key: string]: any;
  };
}

export interface MindmapEdge {
  data: {
    source: string;
    target: string;
    type?: string;
    weight?: number;
    label?: string;
    explanation?: string;
  };
}

export interface MindmapData {
  metadata: {
    organization: string;
    data_source?: string;
    categories?: { id: string; label: string; color: string }[];
    edge_types?: { id: string; label: string; color: string }[];
    coherence_summary?: {
      overall_score: number;
      strong_alignments: number;
      gaps_detected: number;
      tensions_detected: number;
      interpretation?: string;
    };
    [key: string]: any;
  };
  nodes: MindmapNode[];
  edges: MindmapEdge[];
}

// DB Row 타입
export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  client_name: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadRow {
  id: string;
  project_id: string;
  kind: "survey" | "interview";
  filename: string;
  storage_path: string;
  size_bytes: number | null;
  uploaded_at: string;
}

export interface AnalysisRow {
  id: string;
  project_id: string;
  survey_json: SurveyAnalysis | null;
  interview_json: InterviewAnalysis | null;
  mindmap_json: MindmapData | null;
  status: "pending" | "analyzing" | "ready" | "failed";
  error_message: string | null;
  generated_at: string;
}
