import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import DecryptedText from './DecryptedText';



interface SidebarProps {
  className?: string;
  onTopicSelect?: (topic: string | null) => void;
  children?: React.ReactNode;
}
export function Sidebar({ className, onTopicSelect }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [trends, setTrends] = useState<string[]>([]);
  const [selectedTrend, setSelectedTrend] = useState<string | null>(null);
  const [contentVisible, setContentVisible] = useState(!collapsed);


  const toggleSidebar = () => {
    if (!collapsed) {

      setContentVisible(false);
      setTimeout(() => setCollapsed(true), 300);
    } else {

      setCollapsed(false);
      setTimeout(() => setContentVisible(true), 300);
    }
  };


  const fetchTrends = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/trends");
      const data = await response.json();
      setTrends(data);
      console.log("Fetched trends:", data);
    } catch (error) {
      console.error("Error fetching trends:", error);
    }
  };


  const handleSelectTrend = (trend: string) => {
    if (selectedTrend === trend) {

      setSelectedTrend(null);
      if (onTopicSelect) {
        onTopicSelect(null);
      }
      console.log(`Deselected trend: ${trend} - showing full dataset`);
    } else {

      setSelectedTrend(trend);
      if (onTopicSelect) {
        onTopicSelect(trend);
      }
      console.log(`Selected trend: ${trend}`);
    }


  };


  React.useEffect(() => {
    fetchTrends();
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col h-full text-white transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center border-b border-gray-300/20 p-4",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src="/assets/img/tmobile.png" alt="T-Mobile" className="h-6 w-6" />
            <h2
              className={cn(
                "text-xl text-left font-light lowercase tracking-wide transition-opacity duration-200 ease-in-out",
                "text-white/90",
                contentVisible ? "opacity-100" : "opacity-0"
              )}
            >
              topics
            </h2>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-md hover:bg-white/10 transition-colors flex items-center justify-center"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7"></polyline>
              <polyline points="6 17 11 12 6 7"></polyline>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="11 17 6 12 11 7"></polyline>
              <polyline points="18 17 13 12 18 7"></polyline>
            </svg>
          )}
        </button>
      </div>

      {/* Sidebar content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {!collapsed && (
          <div
            className={cn(
              "p-4 space-y-3 transition-all duration-300 ease-in-out",
              contentVisible ? "opacity-100" : "opacity-0"
            )}
          >
            {/* Show All Topics button */}
            <Button
              variant="ghost"
              className={cn(
                "w-full h-10 justify-start text-left font-light tracking-wide",
                "text-white/90 bg-gradient-to-r from-[#E20074]/25 to-[#FF00A0]/25",
                "hover:from-[#E20074]/35 hover:to-[#FF00A0]/35 hover:text-white",
                "border border-[#E20074]/40 hover:border-[#E20074]/60",
                "transition-all duration-300 hover:scale-[1.02]",
                "shadow-lg hover:shadow-[#E20074]/20",
                selectedTrend === null && "from-[#E20074]/45 to-[#FF00A0]/45 border-[#E20074]/70 shadow-[#E20074]/30"
              )}
              onClick={() => {
                setSelectedTrend(null);
                if (onTopicSelect) {
                  onTopicSelect(null);
                }
              }}
            >
              <span className="truncate">show all topics</span>
            </Button>

            {/* Individual trend buttons */}
            {trends.length > 0 ? (
              <div className="flex flex-col gap-2">
                {trends.map((trend, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className={cn(
                      "h-10 justify-start text-left font-light tracking-wide",
                      "text-white/75 bg-transparent hover:bg-[#E20074]/15 hover:text-white",
                      "border-0 transition-all duration-300 hover:scale-[1.02]",
                      "hover:shadow-md hover:shadow-[#E20074]/15",
                      selectedTrend === trend && "bg-[#E20074]/25 text-white shadow-md shadow-[#E20074]/25"
                    )}
                    onClick={() => handleSelectTrend(trend)}
                  >
                    <span className="truncate">{trend}</span>
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 lowercase font-light">loading trends...</p>
            )}
          </div>
        )}

        {/* Collapsed sidebar: Show numbered buttons */}
        {collapsed && (
          <div className="flex flex-col items-center gap-3 mt-4">
            {trends.slice(0, 5).map((trend, index) => (
              <div
                key={index}
                className={cn(
                  "w-8 h-8 rounded-md bg-transparent border-white/20 flex items-center justify-center hover:bg-white/10 cursor-pointer transition-all",
                  contentVisible ? "opacity-0" : "opacity-100",
                  selectedTrend === trend && "bg-white/20"
                )}
                title={trend}
                onClick={() => handleSelectTrend(trend)}
              >
                <span className="text-md ">{index + 1}</span>
              </div>
            ))}
            {trends.length > 5 && (
              <div className="text-xs mt-1 text-gray-400">+{trends.length - 5}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Sidebar;
