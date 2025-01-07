import { useEffect, useRef } from "react";
import * as d3 from "d3";
import dagreD3 from "dagre-d3";
import { Card } from "@/components/ui/card";

interface Node {
  id: string;
  label: string;
  type: "file" | "function" | "class" | "pattern";
  metadata?: Record<string, any>;
}

interface Edge {
  source: string;
  target: string;
  label?: string;
  type: "imports" | "calls" | "extends" | "implements" | "uses";
}

interface ContextMapProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (node: Node) => void;
  className?: string;
}

export function ContextMap({ nodes, edges, onNodeClick, className = "" }: ContextMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    // Create a new directed graph
    const g = new dagreD3.graphlib.Graph().setGraph({
      rankdir: "LR",
      marginx: 20,
      marginy: 20,
      ranksep: 75,
      nodesep: 50,
      edgesep: 10,
    });

    // Add nodes
    nodes.forEach((node) => {
      const className = `node-type-${node.type}`;
      g.setNode(node.id, {
        label: node.label,
        class: className,
        rx: 5,
        ry: 5,
        padding: 10,
      });
    });

    // Add edges
    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target, {
        label: edge.label,
        class: `edge-type-${edge.type}`,
        curve: d3.curveBasis,
      });
    });

    // Create the renderer
    const render = new dagreD3.render();
    const svg = d3.select(svgRef.current);
    const svgGroup = svg.append("g");

    // Run the renderer
    render(svgGroup, g);

    // Center the graph
    const graphWidth = g.graph().width || 0;
    const graphHeight = g.graph().height || 0;
    const svgWidth = parseInt(svg.style("width"));
    const svgHeight = parseInt(svg.style("height"));
    const xCenterOffset = (svgWidth - graphWidth) / 2;
    const yCenterOffset = (svgHeight - graphHeight) / 2;
    svgGroup.attr("transform", `translate(${xCenterOffset}, ${yCenterOffset})`);

    // Add zoom behavior
    const zoom = d3.zoom().on("zoom", (event) => {
      svgGroup.attr("transform", event.transform);
    });
    svg.call(zoom);

    // Add interactivity
    svg
      .selectAll("g.node")
      .on("click", (_event, nodeId: string) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (node && onNodeClick) {
          onNodeClick(node);
        }
      })
      .on("mouseover", function() {
        d3.select(this).classed("node-hover", true);
      })
      .on("mouseout", function() {
        d3.select(this).classed("node-hover", false);
      });

  }, [nodes, edges, onNodeClick]);

  return (
    <Card className={`overflow-hidden ${className}`}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="min-h-[500px]"
        style={{
          background: "var(--background)",
        }}
      >
        <defs>
          <marker
            id="arrowhead"
            viewBox="0 -5 10 10"
            refX={8}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="currentColor" />
          </marker>
        </defs>
      </svg>
    </Card>
  );
}
