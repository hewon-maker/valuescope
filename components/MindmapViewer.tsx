"use client";
import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import type { MindmapData } from "@/lib/supabase/types";

const TYPE_LABEL: Record<string, string> = {
  root: "가치체계 루트",
  category: "가치 카테고리",
  central_value: "경영진 핵심가치",
  survey_value: "지향 가치 (Q1)",
  survey_action_do: "해야 할 행동 (Q2)",
  survey_action_dont: "하지 말 것 (Q3)",
  survey_action_more: "더 해야 할 것 (Q4)",
};
const EDGE_COLOR: Record<string, string> = {
  aligned_strong: "#10b981",
  aligned: "#3b82f6",
  weak: "#6b7280",
  gap: "#ef4444",
  tension: "#f59e0b",
  structure: "#374151",
};
const EDGE_LABEL: Record<string, string> = {
  aligned_strong: "강한 정합", aligned: "정합", weak: "약한 신호", gap: "갭", tension: "내적 긴장",
};

export default function MindmapViewer({ data }: { data: MindmapData }) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [layout, setLayout] = useState<"radial" | "cose">("radial");
  const [activeCats, setActiveCats] = useState<Set<string>>(
    new Set((data.metadata.categories ?? []).map((c) => c.id))
  );
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set(["Q1", "Q2", "Q3", "Q4"]));
  const [activeEdges, setActiveEdges] = useState<Set<string>>(
    new Set(["aligned_strong", "aligned", "weak", "gap", "tension"])
  );
  const [panelWidth, setPanelWidth] = useState<number>(480);
  const [dragging, setDragging] = useState(false);

  // 패널 폭 — localStorage 복원
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("vs-panel-width") : null;
    if (saved) {
      const n = Number(saved);
      if (!isNaN(n)) setPanelWidth(Math.max(320, Math.min(900, n)));
    }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("vs-panel-width", String(panelWidth));
    cyRef.current?.resize();
  }, [panelWidth]);

  const startPanelDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    const startX = e.clientX;
    const startW = panelWidth;
    handle.setPointerCapture(e.pointerId);
    setDragging(true);
    document.body.style.userSelect = "none";

    const onMove = (ev: PointerEvent) => {
      const dx = startX - ev.clientX; // 왼쪽으로 끌면 패널 ↑
      setPanelWidth(Math.max(320, Math.min(900, startW + dx)));
    };
    const onUp = () => {
      try { handle.releasePointerCapture(e.pointerId); } catch {}
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = "";
      setDragging(false);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  const resetPanelWidth = () => setPanelWidth(480);

  useEffect(() => {
    if (!ref.current) return;
    if (cyRef.current) cyRef.current.destroy();

    const cy = cytoscape({
      container: ref.current,
      elements: [...data.nodes, ...data.edges],
      style: [
        {
          selector: "node",
          style: {
            "width": "data(size)" as any,
            "height": "data(size)" as any,
            "background-color": "data(color)",
            "label": "data(label)",
            "color": "#fff",
            "font-size": 13,
            "font-weight": 600,
            "text-valign": "center",
            "text-halign": "center",
            "text-wrap": "wrap",
            "text-max-width": "120",
            "text-outline-width": 2,
            "text-outline-color": "#0f1117",
            "border-width": 1.5,
            "border-color": "rgba(255,255,255,0.15)",
          },
        },
        { selector: 'node[type="root"]', style: { "font-size": 16, "font-weight": 800, "border-width": 3 } },
        {
          selector: 'node[type="category"]',
          style: {
            "background-opacity": 0.08,
            "border-color": "data(color)",
            "border-width": 2,
            "border-style": "dashed",
            "border-opacity": 0.6,
            "font-size": 15,
            "font-weight": 700,
            "color": "data(color)",
            "text-outline-width": 0,
            "text-valign": "top",
            "text-margin-y": -8,
            "padding": "24",
            "shape": "round-rectangle",
          },
        },
        { selector: "node:selected, node.hl", style: { "border-width": 4, "border-color": "#fff", "z-index": 99 } },
        { selector: "node.dim", style: { opacity: 0.18 } },
        { selector: "node.hidden", style: { display: "none" } },
        {
          selector: "edge",
          style: {
            "width": (e: any) => Math.max(1, (e.data("weight") || 0.5) * 3.2),
            "line-color": (e: any) => EDGE_COLOR[e.data("type")] || "#374151",
            "curve-style": "bezier",
            "opacity": 0.7,
          },
        },
        { selector: 'edge[type="structure"]', style: { "line-color": "#2d3140", opacity: 0.4, width: 1.5 } },
        { selector: 'edge[type="aligned_strong"]', style: { "line-color": "#10b981", opacity: 0.85 } },
        { selector: 'edge[type="aligned"]', style: { "line-color": "#3b82f6", opacity: 0.7 } },
        { selector: 'edge[type="weak"]', style: { "line-color": "#6b7280", "line-style": "dashed", opacity: 0.5, width: 1.5 } },
        { selector: 'edge[type="gap"]', style: { "line-color": "#ef4444", "line-style": "dashed", opacity: 0.95, width: 2.5 } },
        { selector: 'edge[type="tension"]', style: { "line-color": "#f59e0b", "line-style": "dashed", opacity: 0.9, width: 2 } },
        { selector: "edge.dim", style: { opacity: 0.06 } },
        { selector: "edge.hidden", style: { display: "none" } },
      ],
      layout: getLayoutOpts(layout),
      minZoom: 0.15,
      maxZoom: 3.5,
      wheelSensitivity: 0.3,
    });

    cy.on("tap", "node", (e) => {
      const n = e.target;
      cy.elements().removeClass("hl dim");
      const conn = n.closedNeighborhood();
      cy.elements().not(conn).addClass("dim");
      conn.addClass("hl");
      setSelected({ data: n.data(), edges: n.connectedEdges().map((e: any) => ({
        data: e.data(),
        otherLabel: (e.source().id() === n.id() ? e.target() : e.source()).data("label"),
      }))});
    });
    cy.on("tap", (e) => {
      if (e.target === cy) {
        cy.elements().removeClass("hl dim");
        setSelected(null);
      }
    });

    cyRef.current = cy;
    return () => { cy.destroy(); };
  }, [data]);

  // 필터 적용
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().forEach((n) => {
      const d: any = n.data();
      let show = true;
      if (d.type === "central_value" && d.parent) show = activeCats.has(d.parent);
      else if (d.type === "category") show = activeCats.has(d.id);
      else if (d.source && d.source.startsWith("Q")) show = activeSources.has(d.source);
      n.toggleClass("hidden", !show);
    });
    cy.edges().forEach((e) => {
      const d: any = e.data();
      if (d.type === "structure") { e.removeClass("hidden"); return; }
      let show = activeEdges.has(d.type);
      if (show) {
        const s = cy.getElementById(d.source);
        const t = cy.getElementById(d.target);
        if (s.hasClass("hidden") || t.hasClass("hidden")) show = false;
      }
      e.toggleClass("hidden", !show);
    });
  }, [activeCats, activeSources, activeEdges]);

  const switchLayout = (l: "radial" | "cose") => {
    setLayout(l);
    if (cyRef.current) cyRef.current.layout(getLayoutOpts(l)).run();
  };

  const toggle = <T,>(set: Set<T>, item: T, fn: (s: Set<T>) => void) => {
    const ns = new Set(set);
    if (ns.has(item)) ns.delete(item); else ns.add(item);
    fn(ns);
  };

  const coh = data.metadata.coherence_summary;

  return (
    <div className="flex h-full">
      {/* 필터 */}
      <aside className="w-56 bg-ink-900 border-r border-ink-700 p-4 overflow-y-auto text-xs">
        <SectionTitle>레이아웃</SectionTitle>
        <div className="flex gap-1 mb-3">
          <button onClick={() => switchLayout("radial")}
            className={`flex-1 py-1.5 rounded text-[11px] font-semibold ${layout === "radial" ? "bg-blue-700 text-white" : "bg-ink-800 text-gray-400"}`}>방사형</button>
          <button onClick={() => switchLayout("cose")}
            className={`flex-1 py-1.5 rounded text-[11px] font-semibold ${layout === "cose" ? "bg-blue-700 text-white" : "bg-ink-800 text-gray-400"}`}>유기적</button>
        </div>

        <SectionTitle>가치 카테고리</SectionTitle>
        {(data.metadata.categories ?? []).map((c) => (
          <FilterRow key={c.id} active={activeCats.has(c.id)} swatch={c.color}
            onClick={() => toggle(activeCats, c.id, setActiveCats)}>{c.label}</FilterRow>
        ))}

        <SectionTitle className="mt-3">서베이 출처</SectionTitle>
        {[
          { id: "Q1", label: "Q1 핵심가치", color: "#a78bfa" },
          { id: "Q2", label: "Q2 해야 할 행동", color: "#86efac" },
          { id: "Q3", label: "Q3 하지 말 것", color: "#fda4af" },
          { id: "Q4", label: "Q4 더 해야 할 것", color: "#c084fc" },
        ].map((q) => (
          <FilterRow key={q.id} active={activeSources.has(q.id)} swatch={q.color}
            onClick={() => toggle(activeSources, q.id, setActiveSources)}>{q.label}</FilterRow>
        ))}

        <SectionTitle className="mt-3">관계 타입</SectionTitle>
        {[
          { id: "aligned_strong", label: "강한 정합", color: "#10b981", line: "solid" },
          { id: "aligned", label: "정합", color: "#3b82f6", line: "solid" },
          { id: "weak", label: "약한 신호", color: "#6b7280", line: "dashed" },
          { id: "gap", label: "갭", color: "#ef4444", line: "dashed" },
          { id: "tension", label: "내적 긴장", color: "#f59e0b", line: "dashed" },
        ].map((e) => (
          <FilterRow key={e.id} active={activeEdges.has(e.id)} line={{ color: e.color, dashed: e.line === "dashed" }}
            onClick={() => toggle(activeEdges, e.id, setActiveEdges)}>{e.label}</FilterRow>
        ))}

        {coh && (
          <div className="mt-4 bg-gradient-to-br from-ink-800 to-ink-900 border border-ink-600 rounded-lg p-3">
            <div className="text-2xl font-extrabold text-blue-400 leading-none">{(coh.overall_score * 100).toFixed(0)}%</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">전체 정합도</div>
            <div className="flex gap-3 mt-2 pt-2 border-t border-ink-700">
              <Stat n={coh.strong_alignments}>강한 정합</Stat>
              <Stat n={coh.gaps_detected}>갭</Stat>
              <Stat n={coh.tensions_detected}>긴장</Stat>
            </div>
            {coh.interpretation && <div className="text-[10.5px] text-gray-400 mt-2 leading-relaxed">{coh.interpretation}</div>}
          </div>
        )}
      </aside>

      {/* 캔버스 */}
      <div className="flex-1 relative bg-ink-950">
        <div ref={ref} className="cy-container" />
      </div>

      {/* 상세 패널 + 드래그 리사이즈 핸들 */}
      {selected && (
        <>
          <div
            onPointerDown={startPanelDrag}
            onDoubleClick={resetPanelWidth}
            role="separator"
            aria-orientation="vertical"
            title="드래그하여 패널 너비 조절 · 더블클릭으로 기본값(480px) 리셋"
            className={`group relative w-1 shrink-0 cursor-ew-resize transition-colors z-20 ${dragging ? "bg-blue-400" : "bg-ink-700 hover:bg-blue-500"}`}
          >
            {/* 넓은 hit area (양쪽으로 8px씩 더) */}
            <div className="absolute -left-2 -right-2 top-0 bottom-0" />
            {/* 그립 점 3개 */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 pointer-events-none">
              <span className={`w-1 h-1 rounded-full ${dragging ? "bg-white" : "bg-gray-500 group-hover:bg-white"}`} />
              <span className={`w-1 h-1 rounded-full ${dragging ? "bg-white" : "bg-gray-500 group-hover:bg-white"}`} />
              <span className={`w-1 h-1 rounded-full ${dragging ? "bg-white" : "bg-gray-500 group-hover:bg-white"}`} />
            </div>
            {/* 드래그 중 현재 폭 표시 */}
            {dragging && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[11px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none">
                {panelWidth}px
              </div>
            )}
          </div>
          <aside style={{ width: panelWidth }} className="shrink-0 bg-ink-900 overflow-y-auto">
            <DetailPanel selected={selected} onClose={() => setSelected(null)} />
          </aside>
        </>
      )}
    </div>
  );
}

function getLayoutOpts(l: "radial" | "cose"): any {
  if (l === "radial") {
    return {
      name: "concentric",
      animate: true, animationDuration: 600,
      concentric: (n: any) => {
        const t = n.data("type");
        if (t === "root") return 100;
        if (t === "category") return 80;
        if (t === "central_value") return 60;
        if (t === "survey_value") return 35;
        return 25;
      },
      levelWidth: () => 1, minNodeSpacing: 36, avoidOverlap: true,
      spacingFactor: 1.2, padding: 60,
    };
  }
  return {
    name: "cose", animate: true, animationDuration: 700, randomize: false,
    nodeRepulsion: () => 18000, idealEdgeLength: 130,
    edgeElasticity: 60, gravity: 0.5, numIter: 1500, fit: true, padding: 70,
  };
}

function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h4 className={`text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-2 ${className}`}>{children}</h4>;
}

function FilterRow({ active, onClick, children, swatch, line }: any) {
  return (
    <label onClick={onClick} className="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer text-gray-400 hover:bg-ink-800 hover:text-gray-200">
      <input type="checkbox" checked={active} readOnly className="cursor-pointer" />
      {swatch && <span className="w-2.5 h-2.5 rounded-full" style={{ background: swatch }} />}
      {line && (
        <span className="w-4 h-0" style={{ borderTop: `2.5px ${line.dashed ? "dashed" : "solid"} ${line.color}` }} />
      )}
      <span className="flex-1">{children}</span>
    </label>
  );
}

function Stat({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="text-[10px] text-gray-500">
      <div className="text-sm text-gray-200 font-bold">{n}</div>
      <div>{children}</div>
    </div>
  );
}

function DetailPanel({ selected, onClose }: { selected: any; onClose: () => void }) {
  const d = selected.data;
  const edges = selected.edges?.filter((e: any) => e.data.type !== "structure") ?? [];
  return (
    <div className="p-5">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-lg font-bold text-white leading-tight">{(d.label || "").replace(/\n/g, " ")}</div>
          <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-ink-700 text-gray-300">
            {TYPE_LABEL[d.type] || d.type}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none ml-2">✕</button>
      </div>

      {d.subthemes && d.subthemes.length > 0 && (
        <Section title="서브테마">
          {d.subthemes.map((t: string) => (
            <span key={t} className="inline-block px-2 py-0.5 rounded-full bg-ink-800 text-blue-300 text-[11px] mr-1.5 mb-1.5">{t}</span>
          ))}
        </Section>
      )}

      {d.speakers && d.speakers.length > 0 && (
        <Section title="발화자">
          {d.speakers.map((s: string) => (
            <span key={s} className="inline-block px-2 py-0.5 rounded-full bg-ink-800 text-blue-300 text-[11px] mr-1.5 mb-1.5">{s}</span>
          ))}
        </Section>
      )}

      {(d.frequency != null) && (
        <Section title="빈도">
          <div className="bg-ink-800 rounded-md px-3 py-2">
            <div className="text-[10px] text-gray-500">{d.source} 순위 {d.rank}위</div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-white">{d.frequency}</div>
              <div className="text-xs text-gray-400">{d.ratio ? (d.ratio * 100).toFixed(0) + "%" : ""}</div>
            </div>
          </div>
        </Section>
      )}

      {d.summary && <Section title="해석"><div className="text-[13.5px] text-gray-200 leading-relaxed bg-ink-800 rounded-md px-4 py-3">{d.summary}</div></Section>}
      {d.sample_quote && <Section title="대표 응답"><Quote>{d.sample_quote}</Quote></Section>}
      {d.by_dept && <Section title="부서 분포"><div className="text-[13.5px] text-gray-200 bg-ink-800 rounded-md px-4 py-3">{d.by_dept}</div></Section>}

      {d.quotes && d.quotes.length > 0 && (
        <Section title="대표 인용구">
          {d.quotes.map((q: string, i: number) => <Quote key={i}>{q}</Quote>)}
        </Section>
      )}

      {edges.length > 0 && (
        <Section title={`연결 관계 (${edges.length})`}>
          {edges.map((e: any, i: number) => {
            const t = e.data.type;
            const cls = {
              aligned_strong: "border-l-emerald-500",
              aligned: "border-l-blue-500",
              weak: "border-l-gray-500",
              gap: "border-l-red-500",
              tension: "border-l-amber-500",
            }[t as string] ?? "border-l-blue-500";
            return (
              <div key={i} className={`bg-ink-800 border-l-2 ${cls} px-3 py-2 mb-1.5 rounded-r text-xs text-gray-300`}>
                <strong className="text-white">{e.otherLabel?.replace(/\n/g, " ")}</strong>
                <div className="text-[11px] text-gray-400 mt-1">
                  <b>{e.data.label || EDGE_LABEL[t] || t}</b>{e.data.weight ? ` (강도 ${(e.data.weight * 100).toFixed(0)}%)` : ""}
                </div>
                {e.data.explanation && <div className="text-[11px] text-gray-500 mt-1 italic leading-snug">{e.data.explanation}</div>}
              </div>
            );
          })}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-2">{title}</h4>
      <div>{children}</div>
    </div>
  );
}
function Quote({ children }: { children: React.ReactNode }) {
  return <div className="bg-ink-800 border-l-2 border-blue-400 px-4 py-3 mb-2 rounded-r text-[13.5px] text-gray-200 leading-relaxed whitespace-pre-wrap break-words">{children}</div>;
}
