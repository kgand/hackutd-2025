import React from "react";

export type ArticleCardProps = {
  title?: string | null;
  source?: string | null;
  summary?: string | null;
};

const ArticleCard: React.FC<ArticleCardProps> = ({ title, source, summary }) => {
  return (
    <div className="w-full rounded-xl shadow-md shadow-slate-600 bg-black/30 backdrop-blur-lg border border-white/20 p-4 text-white/90 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/10">
      <h3 className="text-lg font-light lowercase tracking-wide mb-1">{title ?? "untitled article"}</h3>
      {source ? (
        <div className="text-xs text-blue-400 mb-3 font-light lowercase tracking-wide">source: {source}</div>
      ) : (
        <div className="text-xs text-gray-400 mb-3 font-light lowercase tracking-wide">source: unknown</div>
      )}
      <p className="text-sm leading-relaxed whitespace-pre-line text-white/60 font-light">
        {summary ?? "no summary available."}
      </p>
    </div>
  );
};

export default ArticleCard;
