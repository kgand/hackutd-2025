import React, { useState } from "react";
import Landing from "./routes/Landing";
import Explorer from "./routes/Explorer";
import GraphView from "./routes/GraphView";

type ViewMode = "landing" | "map" | "graph";

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>("landing");
  const [selectedCity, setSelectedCity] = useState<string | undefined>();
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [viewOpacity, setViewOpacity] = useState(1);

  const handleNavigate = (view: 'map' | 'graph', city?: string, topic?: string) => {

    setIsTransitioning(true);
    setViewOpacity(0);


    setTimeout(() => {
      setSelectedCity(city);
      setSelectedTopic(topic);
      setActiveView(view);


      setTimeout(() => {
        setViewOpacity(1);
        setTimeout(() => setIsTransitioning(false), 600);
      }, 50);
    }, 400);
  };

  const handleBackToLanding = () => {

    setIsTransitioning(true);
    setViewOpacity(0);


    setTimeout(() => {
      setActiveView("landing");
      setSelectedCity(undefined);
      setSelectedTopic(undefined);


      setTimeout(() => {
        setViewOpacity(1);
        setTimeout(() => setIsTransitioning(false), 600);
      }, 50);
    }, 400);
  };


  const handleViewSwitch = (view: ViewMode) => {
    if (view === activeView) return;

    setIsTransitioning(true);
    setViewOpacity(0);

    setTimeout(() => {
      setActiveView(view);
      setTimeout(() => {
        setViewOpacity(1);
        setTimeout(() => setIsTransitioning(false), 600);
      }, 50);
    }, 400);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-b from-gray-800 to-black">
      {}
      {activeView !== "landing" && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 flex gap-2 bg-black/30 backdrop-blur-lg rounded-xl p-1 border border-white/20">
          <button
            onClick={handleBackToLanding}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white/90 hover:bg-white/10 transition-all duration-300"
          >
            ← Home
          </button>
          <button
            onClick={() => handleViewSwitch("map")}
            className={[
              "px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300",
              activeView === "map"
                ? "bg-white/20 text-white shadow-md"
                : "text-white/60 hover:text-white/90 hover:bg-white/10"
            ].join(" ")}
          >
            Map View
          </button>
          <button
            onClick={() => handleViewSwitch("graph")}
            className={[
              "px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300",
              activeView === "graph"
                ? "bg-white/20 text-white shadow-md"
                : "text-white/60 hover:text-white/90 hover:bg-white/10"
            ].join(" ")}
          >
            Graph View
          </button>
        </div>
      )}

      {}
      <div
        className="transition-opacity duration-500 ease-in-out"
        style={{ opacity: viewOpacity }}
      >
        {activeView === "landing" && <Landing onNavigate={handleNavigate} />}
        {activeView === "map" && <Explorer initialCity={selectedCity} />}
        {activeView === "graph" && <GraphView initialTopic={selectedTopic} />}
      </div>

      {}
      {isTransitioning && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-[#E20074]/10 via-[#FF00A0]/10 to-[#FF1493]/10 animate-pulse" />
        </div>
      )}
    </div>
  );
};

export default App;