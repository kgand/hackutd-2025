import "../App.css";
import { useState } from "react";
import Galaxy from "../components/Galaxy.js";
import DecryptedText from "../components/DecryptedText.js";
import SplitText from "../components/Text.jsx";
import GlassSearchBar from "../components/GlassSearchBar.jsx";
import Vignette from "../components/Vignette.js";
import LoadingScreen from "../components/LoadingScreen.jsx";
import { motion } from "framer-motion";

const galaxyFocal: [number, number] = [0.5, 0.25];
const galaxyRotation: [number, number] = [1.0, 0.0];

interface LandingProps {
  onNavigate: (view: 'map' | 'graph', city?: string, topic?: string) => void;
}

const Landing: React.FC<LandingProps> = ({ onNavigate }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const [isLoading, setIsLoading] = useState(false);
  const [isIntroComplete, setIsIntroComplete] = useState(true);

  const handleMouseMove = (event: React.MouseEvent) => {
    const { clientX, clientY, currentTarget } = event;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const x = (clientX - left) / width;
    const y = 1.0 - (clientY - top) / height;
    setMousePosition({ x, y });
  };

  return (
    <div className="app-container" onMouseMove={handleMouseMove}>
      {isLoading && <LoadingScreen />}
      {}
      <div className="galaxy-background">
        <Galaxy
          focal={galaxyFocal}
          rotation={galaxyRotation}
          mouseRepulsion={true}
          mouseInteraction={false}
          mousePosition={mousePosition}
          density={1}
          glowIntensity={0.5}
          saturation={0.5}
          hueShift={300}
          repulsionStrength={1.0}
          twinkleIntensity={0.4}
          rotationSpeed={0.1}
          animateIn={false}
        />
      </div>

      {}
      <Vignette />
      <div className="content-container">
        <motion.header
          className="page-header"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
        >
          <h1 className="title" style={{ display: 'flex', alignItems: 'center', gap: '2rem', justifyContent: 'center', marginBottom: '1rem' }}>
            <img
              src="/assets/img/tmobile.png"
              alt="T-Mobile"
              style={{ height: '1em', width: 'auto', flexShrink: 0 }}
            />
            {isIntroComplete && (
              <DecryptedText
                text="magenta"
                animateOn="view"
                sequential={true}
                speed={150}
              />
            )}
          </h1>
          {isIntroComplete && (
            <SplitText
              text="real-time customer happiness. decoded."
              className="subhead"
              tag="p"
              delay={100}
              duration={0.6}
              ease="power3.out"
              splitType="words"
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
              onLetterAnimationComplete={undefined}
            />
          )}
        </motion.header>
        <div className="search-bar-wrapper">
          <GlassSearchBar onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
};

export default Landing;
