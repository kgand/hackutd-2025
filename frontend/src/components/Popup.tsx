import React from 'react';

interface PopupProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const Popup: React.FC<PopupProps> = ({ children, isOpen, onClose, className = '' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative bg-white/10 backdrop-blur-xl rounded-xl p-6 max-w-lg w-full mx-4 border border-white/20 shadow-2xl ${className}`}>
        {children}
      </div>
    </div>
  );
};

export default Popup;
