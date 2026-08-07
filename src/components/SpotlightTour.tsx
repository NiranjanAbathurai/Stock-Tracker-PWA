import React, { useState, useEffect, useCallback, useRef } from 'react';

interface SpotlightStep {
  targetId: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'auto';
}

interface SpotlightTourProps {
  onComplete: () => void;
}

const TOUR_STEPS: SpotlightStep[] = [
  {
    targetId: 'tour-add-item',
    title: '➕ Add Items',
    description:
      'Tap here to add items — choose from Camera scan, Upload a bill image, or Manual entry. Three easy ways to track your stock!',
    position: 'top',
  },
  {
    targetId: 'tour-voice-fab',
    title: '🎤 AI Voice Assistant',
    description:
      'Tap the mic or type commands like "Add 2 kg rice" or "What\'s expiring soon?" — the AI handles it for you!',
    position: 'top',
  },
  {
    targetId: 'tour-product-list',
    title: '↔️ Swipe to Update',
    description:
      'Swipe any item left or right to quickly change its status — Available, Low Stock, or Out of Stock.',
    position: 'bottom',
  },
  {
    targetId: 'tour-nav-profile',
    title: '👤 Your Profile',
    description:
      'Manage your homes, change password, toggle notifications, and access help from the Profile tab.',
    position: 'top',
  },
];

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SpotlightTour: React.FC<SpotlightTourProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('bottom');
  const animFrameRef = useRef<number>(0);

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  const calculatePosition = useCallback(() => {
    if (!step) return;

    const el = document.querySelector(`[data-tour-id="${step.targetId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const padding = 8;
      // Cap highlight height to prevent oversized spotlights on long lists
      const maxHighlightHeight = Math.min(rect.height + padding * 2, 200);
      setTargetRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: maxHighlightHeight,
      });

      // Determine tooltip position
      if (step.position === 'auto' || !step.position) {
        const spaceBelow = window.innerHeight - (rect.top + maxHighlightHeight);
        setTooltipPosition(spaceBelow > 200 ? 'bottom' : 'top');
      } else {
        setTooltipPosition(step.position);
      }
    } else {
      // Element not found — skip to next step or complete
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    // Recalculate on step change and on scroll/resize
    calculatePosition();

    const handleResize = () => calculatePosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [calculatePosition, currentStep]);

  // Scroll target into view
  useEffect(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour-id="${step.targetId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Recalculate after scroll settles
      setTimeout(calculatePosition, 400);
    }
  }, [currentStep, step, calculatePosition]);

  const goNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  // If target element not found, show a fallback message
  if (!targetRect) {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #1a1a2e)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '320px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 16px' }}>
              Add some items to see the full tour! The spotlight will highlight features once content is available.
            </p>
            <button
              onClick={onComplete}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--accent-green)',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Overlay with cutout */}
      <div
        onClick={handleSkip}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          pointerEvents: 'auto',
        }}
      >
        {/* Dark overlay using box-shadow trick on the spotlight hole */}
        <div
          style={{
            position: 'fixed',
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: '12px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
            zIndex: 10001,
            pointerEvents: 'none',
            transition: 'all 0.3s ease',
          }}
        />

        {/* Highlight border around target */}
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - 2,
            left: targetRect.left - 2,
            width: targetRect.width + 4,
            height: targetRect.height + 4,
            borderRadius: '14px',
            border: '2px solid var(--accent-green)',
            zIndex: 10002,
            pointerEvents: 'none',
            transition: 'all 0.3s ease',
            animation: 'spotlightPulse 2s ease-in-out infinite',
          }}
        />
      </div>

      {/* Tooltip — always stays within viewport */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          ...((() => {
            // Calculate safe tooltip position within viewport
            const tooltipHeight = 180; // approximate tooltip height
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - (targetRect.top + targetRect.height);
            const spaceAbove = targetRect.top;

            if (tooltipPosition === 'bottom' && spaceBelow > tooltipHeight) {
              // Normal: place below the element
              return { top: Math.min(targetRect.top + targetRect.height + 16, viewportHeight - tooltipHeight - 20) };
            } else if (tooltipPosition === 'top' && spaceAbove > tooltipHeight) {
              // Normal: place above the element
              return { top: targetRect.top - 16, transform: 'translateX(-50%) translateY(-100%)' };
            } else {
              // Fallback: pin to bottom of viewport with safe margin
              return { bottom: 80 };
            }
          })()),
          width: 'calc(100% - 32px)',
          maxWidth: '340px',
          background: 'var(--bg-card, #1a1a2e)',
          borderRadius: '16px',
          border: '1px solid var(--accent-green)',
          padding: '20px',
          zIndex: 10003,
          animation: 'spotlightTooltipIn 0.3s ease',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Title */}
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 8px 0',
          }}
        >
          {step.title}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            margin: '0 0 16px 0',
          }}
        >
          {step.description}
        </p>

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {currentStep > 0 && (
              <button
                onClick={goPrev}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={goNext}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent-green)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {isLastStep ? 'Done' : 'Next'}
            </button>
          </div>

          {/* Step indicator + Skip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {currentStep + 1}/{TOUR_STEPS.length}
            </span>
            {!isLastStep && (
              <button
                onClick={handleSkip}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                Skip
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes spotlightPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.1); }
        }
        @keyframes spotlightTooltipIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
};

export default SpotlightTour;
