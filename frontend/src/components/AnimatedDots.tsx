import { useState, useEffect } from 'react';

interface AnimatedDotsProps {
  text?: string;
  speed?: number;
}

const AnimatedDots: React.FC<AnimatedDotsProps> = ({
  text = "search",
  speed = 10000
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, speed);

    return () => clearInterval(interval);
  }, [speed]);

  return (
    <span>
      {text}{dots}
    </span>
  );
};

export default AnimatedDots;
