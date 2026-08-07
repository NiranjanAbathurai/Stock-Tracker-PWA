import React, { useState } from 'react';

interface OnboardingTutorialProps {
  onComplete: () => void;
}

interface TutorialStep {
  icon: string;
  title: string;
  description: string;
  illustration: React.ReactNode;
}

const steps: TutorialStep[] = [
  {
    icon: '🏠',
    title: 'Add Your Home',
    description:
      'Create your first home to organize stock by location — kitchen, bedroom, office, or anywhere you store things.',
    illustration: (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {['Kitchen', 'Bedroom', 'Office'].map((name) => (
          <div
            key={name}
            style={{
              padding: '8px 14px',
              borderRadius: '20px',
              border: '1.5px solid var(--accent-green)',
              background: 'rgba(34, 197, 94, 0.1)',
              color: 'var(--accent-green)',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            🏠 {name}
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: '📦',
    title: 'Add Items',
    description:
      'Three ways to add items to your inventory: scan with camera, upload a bill image, or enter manually.',
    illustration: (
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        {[
          { emoji: '📷', label: 'Camera' },
          { emoji: '📤', label: 'Upload' },
          { emoji: '✏️', label: 'Manual' },
        ].map((opt) => (
          <div
            key={opt.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
              }}
            >
              {opt.emoji}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{opt.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: '↔️',
    title: 'Swipe to Update Status',
    description:
      'Swipe left or right on any item to quickly change its status — Available, Low Stock, or Out of Stock.',
    illustration: (
      <div style={{ position: 'relative', padding: '12px 0' }}>
        {/* Simulated swipe card */}
        <div
          style={{
            background: 'var(--bg-input)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>📦 Rice (2 kg)</span>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '3px 8px',
              borderRadius: '8px',
              background: 'rgba(34, 197, 94, 0.15)',
              color: 'var(--accent-green)',
            }}
          >
            In Stock
          </span>
        </div>
        {/* Swipe arrows */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '8px',
            padding: '0 4px',
          }}
        >
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-orange, #F97316)' }}>
            ← Low Stock
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-red, #EF4444)' }}>
            Out of Stock →
          </span>
        </div>
      </div>
    ),
  },
  {
    icon: '🎤',
    title: 'AI Voice Assistant',
    description:
      'Tap the mic button or type a command. Say things like "Add 2 kg rice" or "What is expiring soon?" and the AI handles it.',
    illustration: (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        {/* Mic button */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>
        {/* Chat bubble */}
        <div
          style={{
            background: 'var(--bg-input)',
            borderRadius: '12px',
            padding: '8px 14px',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
          }}
        >
          "Add 2 kg rice to Kitchen"
        </div>
      </div>
    ),
  },
  {
    icon: '👤',
    title: 'Your Profile',
    description:
      'Change your password, manage homes, toggle notifications, and access help — all from the Profile tab.',
    illustration: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { emoji: '🏠', label: 'Manage Homes' },
          { emoji: '🔑', label: 'Change Password' },
          { emoji: '🔔', label: 'Notifications' },
          { emoji: '❓', label: 'Help & Support' },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              background: 'var(--bg-input)',
              borderRadius: '10px',
            }}
          >
            <span style={{ fontSize: '1rem' }}>{item.emoji}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{item.label}</span>
          </div>
        ))}
      </div>
    ),
  },
];

const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep];

  const goNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setDirection('next');
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setDirection('prev');
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          zIndex: 9998,
          animation: 'onboardingFadeIn 0.3s ease',
        }}
      />

      {/* Tutorial Card */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 9999,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '380px',
            background: 'var(--bg-card, #1a1a2e)',
            borderRadius: '20px',
            border: '1px solid var(--border-color, #2a2a3e)',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            animation: 'onboardingSlideUp 0.4s ease',
            maxHeight: '85vh',
            overflowY: 'auto',
          }}
        >
          {/* Skip button */}
          {!isLastStep && (
            <button
              onClick={onComplete}
              style={{
                alignSelf: 'flex-end',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: '4px 8px',
                fontFamily: 'inherit',
              }}
            >
              Skip
            </button>
          )}

          {/* Step Icon */}
          <div style={{ textAlign: 'center', fontSize: '2.5rem' }}>{step.icon}</div>

          {/* Step Title */}
          <h2
            style={{
              textAlign: 'center',
              fontSize: '1.2rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {step.title}
          </h2>

          {/* Step Description */}
          <p
            style={{
              textAlign: 'center',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {step.description}
          </p>

          {/* Illustration */}
          <div
            key={currentStep}
            style={{
              padding: '16px 8px',
              animation: direction === 'next' ? 'onboardingSlideLeft 0.3s ease' : 'onboardingSlideRight 0.3s ease',
            }}
          >
            {step.illustration}
          </div>

          {/* Dot Indicators */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
            {steps.map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: idx === currentStep ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background:
                    idx === currentStep ? 'var(--accent-green)' : 'var(--bg-input, #2a2a3e)',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            {currentStep > 0 && (
              <button
                onClick={goPrev}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
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
                flex: currentStep > 0 ? 2 : 1,
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--accent-green)',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'opacity 0.2s',
              }}
            >
              {isLastStep ? 'Get Started' : 'Next'}
            </button>
          </div>

          {/* Step counter */}
          <p
            style={{
              textAlign: 'center',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              margin: 0,
              opacity: 0.7,
            }}
          >
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes onboardingFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes onboardingSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes onboardingSlideLeft {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes onboardingSlideRight {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
};

export default OnboardingTutorial;
