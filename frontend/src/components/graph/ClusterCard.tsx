import React from "react";
import ArticleCard, { type ArticleCardProps } from "./ArticleCard";

export type ClusterCardProps = {
  title?: string | null;
  summary?: string | null;
  articles?: Array<ArticleCardProps & { id?: number | string }>;
  articleCount?: number;
};

const ClusterCard: React.FC<ClusterCardProps> = ({ title, summary, articles = [], articleCount }) => {
  const count = articleCount ?? articles.length;
  
  return (
    <div className="w-full space-y-4">
      {}
      {count > 0 && (
        <div className="flex items-center justify-end mb-2">
          <div className="rounded-lg shadow-md bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-sm border border-white/20 px-4 py-2">
            <span className="text-xs text-white/80 uppercase tracking-wider font-medium">
              {count} {count === 1 ? 'article' : 'articles'}
            </span>
          </div>
        </div>
      )}
      
      <div className="rounded-xl shadow-lg shadow-slate-700/50 bg-gradient-to-br from-black/40 to-black/20 backdrop-blur-lg border border-white/30 p-5 text-blue-400 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/20 hover:border-white/40">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-1 h-full bg-gradient-to-b from-cyan-400 to-blue-600 rounded-full" />
          <div className="flex-1">
            <h2 className="text-xl font-semibold lowercase tracking-wide mb-2 text-cyan-300">
              {title ?? "untitled cluster"}
            </h2>
            <p className="text-sm leading-relaxed text-white/90 whitespace-pre-line font-light">
              {summary ?? "no summary available for this cluster."}
            </p>
          </div>
        </div>
      </div>

      {articles.length > 0 ? (
        <div className="space-y-3">
          {articles.map((a, idx) => (
            <ArticleCard key={a.id ?? idx} title={a.title} source={a.source} summary={a.summary} />
          ))}
        </div>
      ) : (
        <div className="text-white/60 text-sm font-light lowercase tracking-wide text-center py-4">
          no articles found for this cluster.
        </div>
      )}
    </div>
  );
};

export default ClusterCard;
