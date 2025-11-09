import React from "react";
import CarouselCard from "./CarouselCard";

export type CarouselItem = {
  id: string | number;
  title?: string | null;
  source?: string | null;
};

type CarouselProps = {
  items: CarouselItem[];

  durationSeconds?: number;
  className?: string;
  onItemClick?: (item: CarouselItem) => void;
};


const Carousel: React.FC<CarouselProps> = ({ items, durationSeconds = 40, className, onItemClick }) => {
  const duration = Math.max(5, durationSeconds);
  return (
    <div className={["relative w-full h-full overflow-hidden group", className ?? ""].join(" ")}>
      <style>{`
        @keyframes carousel-marquee-rtl {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .carousel-track {
          display: flex;
          width: max-content;
          animation: carousel-marquee-rtl var(--carousel-duration, 40s) linear infinite;
        }

        .group:hover .carousel-track { animation-play-state: paused; }
        .carousel-group { display: flex; }
      `}</style>

      <div
        className="absolute inset-0 flex items-center"
        style={{
          "--carousel-duration": `${duration}s`,
        } as React.CSSProperties}
      >
        {}
        <div className="carousel-track">
          <div className="carousel-group gap-4 pr-8">
            {items.map((it) => (
              <button
                key={`a-${it.id}`}
                className="flex-shrink-0 min-w-[360px] max-w-[360px] text-left focus:outline-none"
                onClick={() => onItemClick?.(it)}
              >
                <CarouselCard title={it.title} source={it.source} />
              </button>
            ))}
          </div>
          <div className="carousel-group gap-4 pr-8" aria-hidden="true">
            {items.map((it) => (
              <button
                key={`b-${it.id}`}
                className="flex-shrink-0 min-w-[360px] max-w-[360px] text-left focus:outline-none"
                onClick={() => onItemClick?.(it)}
              >
                <CarouselCard title={it.title} source={it.source} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Carousel;
