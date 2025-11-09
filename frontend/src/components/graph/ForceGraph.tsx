import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export type NodeDatum = d3.SimulationNodeDatum & {
  id: string;
  article_summary?: string;
  cluster_id?: number;
  text?: string;
  title?: string;
  article_id?: number;
  source?: string;

  group?: number;

  type?: "cluster" | "article" | string;
};

export type LinkDatum = d3.SimulationLinkDatum<NodeDatum> & {
  source: string | NodeDatum;
  target: string | NodeDatum;
  value?: number;
};

type ForceGraphProps = {
  nodes: NodeDatum[];
  links: LinkDatum[];
  width?: number;
  height?: number;
  showLabels?: boolean;
  zoom?: boolean;
  nodeRadius?: number | ((d: NodeDatum) => number);

  sizeByDegree?: boolean;
  minRadius?: number;
  maxRadius?: number;

  fitParent?: boolean;
  nodeFill?: (d: NodeDatum) => string;
  nodeStroke?: (d: NodeDatum) => string | null | undefined;
  nodeStrokeWidth?: (d: NodeDatum) => number | null | undefined;
  linkStroke?: string;
  chargeStrength?: number;
  linkOpacity?: number;
  centerOnClusterId?: number | null;
  centerScale?: number;
  onNodeClick?: (d: NodeDatum) => void;
};


function computeComponents(nodes: NodeDatum[], links: LinkDatum[]) {
  const adj: Record<string, string[]> = {};
  nodes.forEach((n) => (adj[n.id] = []));
  links.forEach((l) => {
    const src = typeof l.source === "string" ? l.source : l.source.id;
    const tgt = typeof l.target === "string" ? l.target : l.target.id;
    adj[src].push(tgt);
    adj[tgt].push(src);
  });

  let compId = 0;
  const visited = new Set<string>();
  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      compId++;
      const stack = [n.id];
      while (stack.length) {
        const cur = stack.pop()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        const node = nodes.find((d) => d.id === cur);
        if (node) node.group = compId;
        adj[cur].forEach((nbr) => {
          if (!visited.has(nbr)) stack.push(nbr);
        });
      }
    }
  });

  return nodes;
}

const ForceGraph: React.FC<ForceGraphProps> = ({
  nodes,
  links,
  width = 900,
  height = 600,
  showLabels = false,
  zoom = true,
  nodeRadius = 6,
  sizeByDegree = true,
  minRadius = 3,
  maxRadius = 14,
  fitParent = true,
  chargeStrength = -30,
  nodeFill,
  nodeStroke,
  nodeStrokeWidth,
  linkStroke = "#FFF",
  linkOpacity = 1,
  centerOnClusterId,
  centerScale,
  onNodeClick,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: width, h: height });

  const nodeSelRef = useRef<d3.Selection<SVGCircleElement, NodeDatum, SVGGElement, unknown> | null>(null);
  const linkSelRef = useRef<d3.Selection<SVGLineElement, LinkDatum, SVGGElement, unknown> | null>(null);
  const labelSelRef = useRef<d3.Selection<SVGTextElement, NodeDatum, SVGGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<NodeDatum, LinkDatum> | null>(null);
  const degreeMapRef = useRef<Map<string, number>>(new Map());
  const degScaleRef = useRef<d3.ScaleLinear<number, number>>(d3.scaleLinear<number, number>().domain([0, 1]).range([minRadius, maxRadius]));
  const defaultColorRef = useRef<d3.ScaleOrdinal<string, string>>(d3.scaleOrdinal(d3.schemeDark2));
  const onNodeClickRef = useRef<ForceGraphProps["onNodeClick"]>(onNodeClick);
  const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);


  useEffect(() => {
    if (centerOnClusterId == null) return;
    const sim = simulationRef.current;
    const svg = svgRef.current;
    const zoomB = zoomRef.current;
    if (!sim || !svg || !zoomB) return;

    const nodesArr = sim.nodes() as NodeDatum[];
    const target = nodesArr.find(
      (n) => n.type === "cluster" && n.cluster_id === centerOnClusterId
    );
    if (!target || target.x == null || target.y == null) return;

    const k = typeof centerScale === "number" ? centerScale : 1.8;



    const t = d3.zoomIdentity
      .translate(-k * (target.x ?? 0), -k * (target.y ?? 0))
      .scale(k);



  const transition = svg.transition().duration(500).ease(d3.easeCubicOut);
  transition.call(zoomB.transform, t);
  }, [centerOnClusterId, centerScale, size.w, size.h, fitParent, width, height]);


  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);

  useEffect(() => {
    if (fitParent && containerRef.current) {
      const el = containerRef.current;
      const ro = new ResizeObserver((entries) => {
        for (const e of entries) {
          const { width: w, height: h } = e.contentRect;

          setSize({ w: Math.max(10, Math.floor(w)), h: Math.max(10, Math.floor(h)) });
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [fitParent]);


  useEffect(() => {
    if (!containerRef.current) return;

    const N = computeComponents(nodes.map((d) => ({ ...d })), links);
    const L = links.map((d) => ({ ...d }));


    const degree = new Map<string, number>();
    for (const l of L) {
      const s = typeof l.source === "string" ? l.source : String((l.source as NodeDatum).id);
      const t = typeof l.target === "string" ? l.target : String((l.target as NodeDatum).id);
      degree.set(s, (degree.get(s) ?? 0) + 1);
      degree.set(t, (degree.get(t) ?? 0) + 1);
    }
    degreeMapRef.current = degree;
    const maxDeg = N.reduce((m, n) => Math.max(m, degree.get(String(n.id)) ?? 0), 0);
    degScaleRef.current = d3.scaleLinear<number, number>().domain([0, Math.max(1, maxDeg)]).range([minRadius, maxRadius]);

    const W = fitParent ? size.w : width;
    const H = fitParent ? size.h : height;
    if (!W || !H) return;

    const svg = d3
      .select(containerRef.current)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `${-W / 2} ${-H / 2} ${W} ${H}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("style", "display:block; width:100%; height:100%; background: transparent;");

  const g = svg.append("g").attr("class", "transition-transform duration-500 ease-out");
  svgRef.current = svg;
  gRef.current = g;

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => g.attr("transform", event.transform.toString()));
    zoomRef.current = zoomBehavior;

    if (zoom) svg.call(zoomBehavior);
    svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(0, 0).scale(1));

    const link = g
      .append("g")
      .attr("stroke", linkStroke)
      .attr("stroke-opacity", linkOpacity)
      .selectAll("line")
      .data(L)
      .join("line")
      .attr("stroke-width", (d) => Math.sqrt(d.value ?? 1));
    linkSelRef.current = link as d3.Selection<SVGLineElement, LinkDatum, SVGGElement, unknown>;

    const node = g
      .append("g")
      .selectAll("circle")
      .data(N)
      .join("circle")
      .on("click", (_, d) => onNodeClickRef.current?.(d))
      .style("cursor", "pointer")

      .attr("class", "transition-colors duration-300 ease-in-out");
    nodeSelRef.current = node as d3.Selection<SVGCircleElement, NodeDatum, SVGGElement, unknown>;


    const r =
      typeof nodeRadius === "function"
        ? nodeRadius
        : (d: NodeDatum) => (sizeByDegree ? degScaleRef.current(degreeMapRef.current.get(String(d.id)) ?? 0) : (nodeRadius as number));
    node
      .attr("r", (d) => r(d))
      .style("fill", (d) => (nodeFill ? nodeFill(d) : defaultColorRef.current(String(d.group!))))
      .style("stroke", (d) => (nodeStroke ? (nodeStroke(d) ?? "") : ""))
      .attr("stroke-width", (d) => (nodeStrokeWidth ? ((nodeStrokeWidth(d) ?? 0.5) as number) : 0.5));

    (nodeSelRef.current as d3.Selection<SVGCircleElement, NodeDatum, SVGGElement, unknown>).call(
      d3
        .drag<SVGCircleElement, NodeDatum>()
        .on("start", (event, d) => {
          const sim = simulationRef.current!;
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          const sim = simulationRef.current!;
          if (!event.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );


    const labelBackgrounds = showLabels
      ? g
          .append("g")
          .attr("class", "label-backgrounds")
          .selectAll("rect")
          .data(N.filter(d => d.type === "cluster"))
          .join("rect")
          .attr("fill", "rgba(0, 0, 0, 0.4)")
          .attr("stroke", "rgba(255, 255, 255, 0.2)")
          .attr("stroke-width", 1)
          .attr("rx", 6)
          .attr("ry", 6)
          .style("backdrop-filter", "blur(10px)")
          .attr("pointer-events", "none")
      : null;

    const label = showLabels
      ? g
          .append("g")
          .attr("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial")
          .attr("font-size", 12)
          .attr("font-weight", "500")
          .attr("letter-spacing", "0.025em")
          .attr("fill", "rgba(255, 255, 255, 0.95)")
          .attr("pointer-events", "none")
          .selectAll("text")
          .data(N)
          .join("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .text((d) => {

            if (d.type === "cluster") {
              const title = d.title || `cluster ${d.cluster_id}`;

              return title.replace(/^T-Mobile\s+/i, '').toLowerCase();
            }
            return "";
          })
      : null;

    if (label) {
      labelSelRef.current = label as d3.Selection<SVGTextElement, NodeDatum, SVGGElement, unknown>;
    } else {
      labelSelRef.current = null;
    }


    const labelBackgroundsRef = labelBackgrounds;

    const simulation = d3
      .forceSimulation(N)
      .force("link", d3.forceLink<NodeDatum, LinkDatum>(L).id((d) => d.id).distance((d) => {

        if (typeof d.source === 'object' && typeof d.target === 'object') {
          const sourceNode = d.source as NodeDatum;
          const targetNode = d.target as NodeDatum;
          if (sourceNode.type === 'cluster' && targetNode.type === 'cluster') {
            return 60;
          }
        }
        return 40;
      }).strength((d) => {
        if (typeof d.source === 'object' && typeof d.target === 'object') {
          const sourceNode = d.source as NodeDatum;
          const targetNode = d.target as NodeDatum;
          if (sourceNode.type === 'cluster' && targetNode.type === 'cluster') {
            return 1.0;
          }
        }
        return 0.7;
      }))
      .force("charge", d3.forceManyBody().strength((d: NodeDatum) => {

        return d.type === 'cluster' ? chargeStrength * 1.2 : chargeStrength * 0.8;
      }))
      .force("collision", d3.forceCollide().radius((d: NodeDatum) => {

        const baseRadius = typeof nodeRadius === "function"
          ? nodeRadius(d)
          : sizeByDegree
            ? degScaleRef.current(degreeMapRef.current.get(String(d.id)) ?? 0)
            : (nodeRadius as number);
        return d.type === 'cluster' ? baseRadius + 18 : baseRadius + 8;
      }).strength(0.9))

      .force("radial", d3.forceRadial<NodeDatum>((d) => {
        if (d.type === 'cluster' && d.group !== undefined && d.group >= 0) {
          return 120;
        }
        return 0;
      }, 0, 0).strength((d) => {
        return d.type === 'cluster' && d.group !== undefined && d.group >= 0 ? 0.3 : 0;
      }))
      .force("x", d3.forceX((d: NodeDatum) => {

        if (d.type === 'cluster' && d.group !== undefined && d.group >= 0) {
          const angle = (d.group * 2 * Math.PI) / 10;
          return Math.cos(angle) * 150;
        }
        return 0;
      }).strength(0.2))
      .force("y", d3.forceY((d: NodeDatum) => {
        if (d.type === 'cluster' && d.group !== undefined && d.group >= 0) {
          const angle = (d.group * 2 * Math.PI) / 10;
          return Math.sin(angle) * 150;
        }
        return 0;
      }).strength(0.2));

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (typeof d.source === "object" ? d.source.x ?? 0 : 0))
        .attr("y1", (d) => (typeof d.source === "object" ? d.source.y ?? 0 : 0))
        .attr("x2", (d) => (typeof d.target === "object" ? d.target.x ?? 0 : 0))
        .attr("y2", (d) => (typeof d.target === "object" ? d.target.y ?? 0 : 0));

      nodeSelRef.current!.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);

      if (labelSelRef.current) {
        const getR = (d: NodeDatum) =>
          typeof nodeRadius === "function"
            ? (nodeRadius as (d: NodeDatum) => number)(d)
            : sizeByDegree
            ? degScaleRef.current(degreeMapRef.current.get(String(d.id)) ?? 0)
            : (nodeRadius as number);


        labelSelRef.current
          .attr("x", (d) => d.x ?? 0)
          .attr("y", (d) => (d.y ?? 0) + getR(d) + 14);


        if (labelBackgroundsRef) {
          labelBackgroundsRef
            .attr("x", (d: NodeDatum) => {
              const text = d.title?.replace(/^T-Mobile\s+/i, '').toLowerCase() || '';
              const textWidth = text.length * 7;
              return (d.x ?? 0) - textWidth / 2 - 6;
            })
            .attr("y", (d: NodeDatum) => (d.y ?? 0) + getR(d) + 14 - 10)
            .attr("width", (d: NodeDatum) => {
              const text = d.title?.replace(/^T-Mobile\s+/i, '').toLowerCase() || '';
              return text.length * 7 + 12;
            })
            .attr("height", 20);
        }
      }
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      svg.remove();
      simulationRef.current = null;
      nodeSelRef.current = null;
      linkSelRef.current = null;
      labelSelRef.current = null;
    };

  }, [nodes, links, width, height, showLabels, zoom, linkStroke, linkOpacity, chargeStrength, sizeByDegree, minRadius, maxRadius, fitParent, size.w, size.h]);


  useEffect(() => {
    const node = nodeSelRef.current;
    if (!node) return;
    node
      .style("fill", (d) => (nodeFill ? nodeFill(d) : defaultColorRef.current(String(d.group!))))
      .style("stroke", (d) => nodeStroke?.(d) ?? "")
      .attr("stroke-width", (d) => ((nodeStrokeWidth?.(d) ?? 0.5) as number));
  }, [nodeFill, nodeStroke, nodeStrokeWidth]);


  useEffect(() => {
    const node = nodeSelRef.current;
    if (!node) return;
    degScaleRef.current.range([minRadius, maxRadius]);
    const r =
      typeof nodeRadius === "function"
        ? nodeRadius
        : (d: NodeDatum) => (sizeByDegree ? degScaleRef.current(degreeMapRef.current.get(String(d.id)) ?? 0) : (nodeRadius as number));
    node.attr("r", (d) => r(d));
    if (labelSelRef.current) {
      const getR = (d: NodeDatum) =>
        typeof nodeRadius === "function"
          ? (nodeRadius as (d: NodeDatum) => number)(d)
          : sizeByDegree
          ? degScaleRef.current(degreeMapRef.current.get(String(d.id)) ?? 0)
          : (nodeRadius as number);
      labelSelRef.current
        .attr("x", (d) => d.x ?? 0)
        .attr("y", (d) => (d.y ?? 0) + getR(d) + 14);
    }
  }, [nodeRadius, sizeByDegree, minRadius, maxRadius]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default ForceGraph;
