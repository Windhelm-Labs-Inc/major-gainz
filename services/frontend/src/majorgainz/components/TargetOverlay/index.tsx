import React, { useState, useEffect } from 'react';

interface TargetOverlayProps {
  isVisible?: boolean;
  duration?: number;
  onComplete?: () => void;
}

const TargetOverlay: React.FC<TargetOverlayProps> = ({
  isVisible = false,
  duration = 2000,
  onComplete
}) => {
  const [animationPhase, setAnimationPhase] = useState<'hidden' | 'scanning' | 'locked' | 'complete'>('hidden');

  useEffect(() => {
    if (!isVisible) {
      setAnimationPhase('hidden');
      return;
    }

    // Animation sequence
    const timer1 = setTimeout(() => setAnimationPhase('scanning'), 100);
    const timer2 = setTimeout(() => setAnimationPhase('locked'), duration * 0.7);
    const timer3 = setTimeout(() => {
      setAnimationPhase('complete');
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isVisible, duration, onComplete]);

  if (animationPhase === 'hidden') return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 60, 131, 0.9)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--mg-font-family)',
    animation: animationPhase === 'complete' ? 'fadeOut 0.5s ease-out forwards' : undefined,
  };

  const crosshairStyle: React.CSSProperties = {
    position: 'relative',
    width: '200px',
    height: '200px',
    border: `3px solid ${animationPhase === 'locked' ? 'var(--mg-mint-500)' : '#ffffff'}`,
    borderRadius: '50%',
    animation: animationPhase === 'scanning' ? 'pulse 1s ease-in-out infinite' : undefined,
    transition: 'border-color 0.3s ease',
  };

  const centerDotStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '8px',
    height: '8px',
    background: animationPhase === 'locked' ? 'var(--mg-mint-500)' : '#ffffff',
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    transition: 'background-color 0.3s ease',
  };

  const lineStyle: React.CSSProperties = {
    position: 'absolute',
    background: animationPhase === 'locked' ? 'var(--mg-mint-500)' : '#ffffff',
    transition: 'background-color 0.3s ease',
  };

  const horizontalLineStyle: React.CSSProperties = {
    ...lineStyle,
    top: '50%',
    left: '20px',
    right: '20px',
    height: '2px',
    transform: 'translateY(-50%)',
  };

  const verticalLineStyle: React.CSSProperties = {
    ...lineStyle,
    left: '50%',
    top: '20px',
    bottom: '20px',
    width: '2px',
    transform: 'translateX(-50%)',
  };

  const statusTextStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '-60px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: animationPhase === 'locked' ? 'var(--mg-mint-500)' : '#ffffff',
    fontSize: '1.25rem',
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    transition: 'color 0.3s ease',
  };

  const getStatusText = () => {
    switch (animationPhase) {
      case 'scanning': return 'Scanning Target...';
      case 'locked': return 'Target Acquired';
      case 'complete': return 'Mission Ready';
      default: return '';
    }
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        
        @keyframes fadeOut {
          to { opacity: 0; visibility: hidden; }
        }
      `}</style>
      
      <div style={overlayStyle}>
        <div style={crosshairStyle}>
          <div style={horizontalLineStyle} />
          <div style={verticalLineStyle} />
          <div style={centerDotStyle} />
          
          <div style={statusTextStyle}>
            {getStatusText()}
          </div>
        </div>
      </div>
    </>
  );
};

export default TargetOverlay;
