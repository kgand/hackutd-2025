import React from 'react';
import { motion } from 'framer-motion';
import { Slab } from 'react-loading-indicators';
import './LoadingScreen.css';

const LoadingScreen = () => {
  return (
    <motion.div
      className="loading-screen"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1, delay: 2.5 }}
    >
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.5, delay: 2 }}
      >
        <Slab color="white" size="medium" />
      </motion.div>
    </motion.div>
  );
};

export default LoadingScreen;
