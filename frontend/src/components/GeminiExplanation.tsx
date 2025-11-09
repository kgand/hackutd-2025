import { useState, useEffect } from "react";
import { Button } from "./ui/button";

interface GeminiExplanationProps {
  topic: string | null;
  className?: string;
}

export function GeminiExplanation({ topic, className }: GeminiExplanationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [showButton, setShowButton] = useState(true);
  const [displayText, setDisplayText] = useState("");

  const fetchExplanation = async () => {
    if (!topic) return;

    setIsLoading(true);
    setShowButton(false);

    try {
      const response = await fetch(`http://localhost:3000/api/summary/${encodeURIComponent(topic)}`);
      const data = await response.json();


      const fullText = data.summary;
      setExplanation(fullText);


      let currentText = "";
      for (let i = 0; i < fullText.length; i++) {
        currentText += fullText[i];
        setDisplayText(currentText);
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    } catch (error) {
      console.error("Failed to fetch explanation:", error);
      setDisplayText("Failed to load explanation.");
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    setExplanation(null);
    setDisplayText("");
    setShowButton(true);
    setIsLoading(false);
  }, [topic]);

  if (!topic) return null;

  return (
    <div className={`p-4 w-64 mt-4 bg-black/30 text-sm backdrop-blur-lg rounded-xl border border-[#E20074]/30 shadow-lg shadow-[#E20074]/10 transition-all duration-500 ease-in-out ${
      !showButton && explanation ? "opacity-100" : "opacity-90"
    } ${className}`}>
      {showButton ? (
        <Button
          onClick={fetchExplanation}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-[#E20074] to-[#FF00A0] hover:from-[#9B006B] hover:to-[#E20074] text-white text-sm font-light lowercase tracking-wide transition-all duration-300 hover:scale-[1.02] shadow-lg hover:shadow-[#E20074]/30"
        >
          {isLoading ? "loading..." : "elaborate"}
        </Button>
      ) : (
        <div className="text-white/90 prose prose-invert max-w-none font-light">
          {displayText || (
            <div className="flex items-center justify-center h-20">
              <div className="animate-pulse lowercase font-light tracking-wide">generating explanation...</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
