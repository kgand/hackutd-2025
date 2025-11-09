import { useEffect, useMemo, useState, useRef } from "react";
import * as d3 from "d3";
import GlassCard from "../components/graph/GlassCard";
import ForceGraph, { type NodeDatum, type LinkDatum } from "../components/graph/ForceGraph";
import GraphButton from "../components/graph/GraphButton";
import ArticleCard from "../components/graph/ArticleCard";
import ClusterCard from "../components/graph/ClusterCard";
import OutageMonitor from "../components/graph/OutageMonitor";
import DecryptedText from "../components/DecryptedText";
import { transformServerDataToGraphView, type Article, type Cluster } from "../lib/dataTransform";


interface GraphViewProps {
  initialTopic?: string;
}

const GraphView: React.FC<GraphViewProps> = ({ initialTopic }) => {
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<NodeDatum | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Function to play topic audio
  const playTopicAudio = async (topicName: string) => {
    try {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_BASE_URL}/api/audio/${encodeURIComponent(topicName)}`);
      
      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
        console.log(`Playing audio for topic: ${topicName}`);
      } else {
        console.log(`No audio available for topic: ${topicName}`);
      }
    } catch (err) {
      console.log(`Could not play audio for topic: ${topicName}`, err);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

    useEffect(() => {
      let cancelled = false;
      async function load() {
        try {
          setLoading(true);
          const data = await transformServerDataToGraphView();

          if (cancelled) return;
          setArticles(data.articles);
          setClusters(data.clusters);
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "Failed to load data";
          if (!cancelled) setError(message);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      load();
      return () => {
        cancelled = true;
      };
    }, []);


    useEffect(() => {
      if (initialTopic && clusters.length > 0 && !selectedClusterId) {
        const matchingCluster = clusters.find(
          (c) => c.cluster_title?.toLowerCase() === initialTopic.toLowerCase()
        );

        if (matchingCluster) {
          const node: NodeDatum = {
            id: `cluster-${matchingCluster.cluster_id}`,
            type: "cluster",
            cluster_id: matchingCluster.cluster_id,
            title: matchingCluster.cluster_title ?? undefined,
            article_summary: matchingCluster.cluster_summary,
          };
          setFocusedNode(node);
          setSelectedClusterId(matchingCluster.cluster_id);
        }
      }
    }, [initialTopic, clusters, selectedClusterId]);


    const { nodes, links } = useMemo(() => {
      const n: NodeDatum[] = [];
      const l: LinkDatum[] = [];


      const clusterById = new Map<number, Cluster>();
      for (const c of clusters) clusterById.set(c.cluster_id, c);


      for (const c of clusters) {
        n.push({
          id: `cluster-${c.cluster_id}`,
          type: "cluster",
          cluster_id: c.cluster_id,
          title: c.cluster_title ?? undefined,
          article_summary: c.cluster_summary,
        });
      }


      for (const a of articles) {
        const id = `article-${a.article_id}`;
        n.push({
          id,
          type: "article",
          article_id: a.article_id,
          article_summary: a.article_summary,
          cluster_id: a.cluster_id,
          title: a.title,
          text: a.text,
          source: a.source,
        });

        if (a.cluster_id != null && clusterById.has(a.cluster_id)) {
          l.push({
            source: id,
            target: `cluster-${a.cluster_id}`,
            value: 1,
          });
        }
      }



      const createClusterConnections = () => {
        const clusterList = Array.from(clusterById.values());


        const topicGroups: string[][] = [

          ['5g', 'network', 'coverage', 'home', 'internet'],

          ['customer', 'service', 'support', 'store', 'app'],

          ['billing', 'plans', 'prepaid', 'family', 'business'],

          ['deals', 'promotions', 'monday', 'tuesdays'],

          ['upgrade', 'trade-in', 'roaming'],
        ];


        const findTopicGroup = (title: string): number => {
          const lowerTitle = title.toLowerCase();
          for (let i = 0; i < topicGroups.length; i++) {
            if (topicGroups[i].some(keyword => lowerTitle.includes(keyword))) {
              return i;
            }
          }
          return -1;
        };


        for (let i = 0; i < clusterList.length; i++) {
          const cluster1 = clusterList[i];
          const title1 = cluster1.cluster_title?.toLowerCase() || '';
          const group1 = findTopicGroup(title1);

          if (group1 === -1) continue;

          for (let j = i + 1; j < clusterList.length; j++) {
            const cluster2 = clusterList[j];
            const title2 = cluster2.cluster_title?.toLowerCase() || '';
            const group2 = findTopicGroup(title2);


            if (group1 === group2 && group1 !== -1) {
              l.push({
                source: `cluster-${cluster1.cluster_id}`,
                target: `cluster-${cluster2.cluster_id}`,
                value: 5,
              });
            }
          }
        }
      };

      createClusterConnections();

      return { nodes: n, links: l };
    }, [articles, clusters]);


    const clusterColor = useMemo(() => {

      const palette = [
        "#E20074",
        "#FF007F",
        "#C4007A",
        "#FF6B9D",
        "#9E0059",
        "#7C3AED",
      ];

      for (let i = palette.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [palette[i], palette[j]] = [palette[j], palette[i]];
      }
      const scale = d3.scaleOrdinal<number, string>(palette as string[]);
      return (cluster_id?: number) => (cluster_id == null ? "#64748B" : scale(cluster_id));
  }, []);

    return (
    <div className="bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900 min-h-screen flex items-center justify-center p-3">
      <div className="flex flex-col md:flex-row items-stretch md:items-stretch justify-center gap-4 w-full h-[96vh]">
        {/* Left Sidebar - Topics */}
        <div className="w-[min(36vw,360px)] flex flex-col gap-4 min-h-0">
          <GlassCard className="flex-1 min-h-0">
            <div className="p-4 flex flex-col gap-3 h-full no-scrollbar overflow-auto">
              <div className="flex items-center justify-center py-4 border-b border-purple-500/20 gap-3">
                <img src="/assets/img/tmobile.png" alt="T-Mobile" className="h-7 w-7" />
                <h1 className="text-2xl font-light text-purple-100 lowercase tracking-wide">
                  topics
                </h1>
              </div>
              <div className="flex flex-col gap-2 pr-1 no-scrollbar">
                {clusters.map((cluster) => {
                  const textColor = clusterColor(cluster.cluster_id) as string;
                  return (
                    <GraphButton
                      key={cluster.cluster_id}
                      className={["text-semibold bg-black/20 hover:bg-purple-900/30"].join(" ")}
                      onClick={() => {
                        const node: NodeDatum = {
                          id: `cluster-${cluster.cluster_id}`,
                          type: "cluster",
                          cluster_id: cluster.cluster_id,
                          title: cluster.cluster_title ?? undefined,
                          article_summary: cluster.cluster_summary,
                        };
                        setFocusedNode(node);
                        setSelectedClusterId(cluster.cluster_id);
                      }}
                    >
                      <span
                        style={{
                          color: textColor,
                        }}
                      >
                        {cluster.cluster_title ?? `cluster ${cluster.cluster_id}`}
                      </span>
                    </GraphButton>
                  );
                })}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Center - Graph and DownDetector Monitor */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Graph - 70% */}
          <GlassCard className="flex-[7] min-h-0 overflow-hidden">
            {error ? (
              <div className="p-4 text-red-400 font-light lowercase tracking-wide">{error}</div>
            ) : loading ? (
              <div className="p-4 text-gray-300 font-light lowercase tracking-wide">loading graph…</div>
            ) : (
              <ForceGraph
                nodes={nodes}
                links={links}
                chargeStrength={-150}
                width={1100}
                height={1000}
                onNodeClick={(node) => {
                  setFocusedNode(node);
                  if (node.type === "cluster" && node.cluster_id != null) {
                    setSelectedClusterId(node.cluster_id);
                    // Play audio for the selected topic
                    if (node.title) {
                      playTopicAudio(node.title);
                    }
                  }
                }}
                showLabels={true}
                zoom
                centerOnClusterId={selectedClusterId}
                centerScale={1.8}
                nodeFill={(d) =>
                  d.type === "article"
                    ? "#FF00FF"
                    : (selectedClusterId != null && d.cluster_id === selectedClusterId
                        ? "#FFFFFF"
                        : clusterColor(d.cluster_id))
                }
                nodeRadius={(d) => {
                  if (d.type === "cluster") {
                    const base = 14;
                    const selected = 20;
                    return d.cluster_id != null && d.cluster_id === selectedClusterId ? selected : base;
                  } else {
                    return 5;
                  }
                }}
                sizeByDegree={false}
              />
            )}
          </GlassCard>
          
          {/* DownDetector Monitor - 30% */}
          <GlassCard className="flex-[3] min-h-0 overflow-hidden">
            <div className="w-full h-full">
              <OutageMonitor />
            </div>
          </GlassCard>
        </div>

        {/* Right Sidebar - Details */}
        <GlassCard className="w-[min(22vw,300px)] min-h-0 overflow-hidden flex flex-col">
          <div className="p-4 space-y-4 h-full overflow-auto no-scrollbar">
            {!focusedNode ? (
              <div className="text-purple-200/60 text-center font-light lowercase tracking-wide py-8">
                <DecryptedText
                  text="select a node to see details"
                  animateOn="view"
                  sequential={true}
                  speed={80}
                />
              </div>
            ) : focusedNode.type === "article" ? (
              <ArticleCard
                title={focusedNode.title}
                source={(focusedNode as NodeDatum & { source?: string }).source ?? undefined}
                summary={focusedNode.article_summary}
              />
            ) : (
              (() => {
                const cid = focusedNode.cluster_id as number | undefined;
                const clusterMeta = clusters.find((c) => c.cluster_id === cid);
                const clusterArticles = articles
                  .filter((a) => a.cluster_id === cid)
                  .map((a) => ({ id: a.article_id, title: a.title, source: a.source ?? null, summary: a.article_summary ?? null }));
                return (
                  <ClusterCard
                    title={clusterMeta?.cluster_title ?? `Cluster ${cid ?? ""}`}
                    summary={clusterMeta?.cluster_summary ?? (focusedNode.article_summary ?? null)}
                    articles={clusterArticles}
                    articleCount={clusterArticles.length}
                  />
                );
              })()
            )}
          </div>
        </GlassCard>
      </div>
  </div>
    );
};

export default GraphView;
