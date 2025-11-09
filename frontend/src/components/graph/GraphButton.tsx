import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
};

export default function GraphButton({ className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center text-left gap-2 rounded-xl px-4 py-2 text-md",
        "bg-black/30 backdrop-blur-lg border border-white/20",
        "shadow hover:bg-white/10 active:bg-white/20 transition-all duration-300 hover:scale-[1.02]",
        "hover:shadow-lg hover:shadow-blue-500/10 shadow-slate-600",
        "font-light lowercase tracking-wide",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
