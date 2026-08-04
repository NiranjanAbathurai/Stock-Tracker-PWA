import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

type SignInFormValues = {
  email: string;
  password: string;
};

type SignInFormProps = {
  onSubmit: (email: string, password: string) => Promise<boolean>;
  onSwitchToSignUp: () => void;
  error: string | null;
};

// SECURITY: Rate limiting constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 2 * 60 * 1000; // 2 minutes

export const SignInForm = ({ onSubmit, onSwitchToSignUp, error }: SignInFormProps) => {
  const form = useForm<SignInFormValues>({
    defaultValues: { email: '', password: '' },
  });

  // SECURITY: Track failed login attempts for rate limiting
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutMessage, setLockoutMessage] = useState<string | null>(null);
  const attemptsRef = useRef(0);
  const lockoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = async (data: SignInFormValues) => {
    // SECURITY: Check if account is locked due to too many attempts
    if (isLocked) {
      return;
    }

    const success = await onSubmit(data.email, data.password);

    if (!success) {
      attemptsRef.current += 1;

      if (attemptsRef.current >= MAX_ATTEMPTS) {
        // Lock the form for LOCKOUT_DURATION_MS
        setIsLocked(true);
        setLockoutMessage(`Too many failed attempts. Please wait 2 minutes before trying again.`);

        lockoutTimerRef.current = setTimeout(() => {
          setIsLocked(false);
          setLockoutMessage(null);
          attemptsRef.current = 0;
        }, LOCKOUT_DURATION_MS);
      }
    } else {
      // Reset on successful login
      attemptsRef.current = 0;
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
      <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#1db954', fontSize: '1.25rem' }}>
        Sign In
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Input<SignInFormValues>
          label="Email"
          name="email"
          type="email"
          register={form.register}
          rules={{
            required: 'Email is required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
          }}
          error={form.formState.errors.email?.message}
          required
        />

        <Input<SignInFormValues>
          label="Password"
          name="password"
          type="password"
          register={form.register}
          rules={{
            required: 'Password is required',
            minLength: { value: 6, message: 'Password must be at least 6 characters' },
          }}
          error={form.formState.errors.password?.message}
          required
        />

        {/* Show lockout message */}
        {lockoutMessage && (
          <p style={{ color: '#ff9800', textAlign: 'center', fontSize: '0.85rem', margin: 0 }}>
            🔒 {lockoutMessage}
          </p>
        )}

        {/* Show regular error (only if not locked) */}
        {error && !lockoutMessage && (
          <p style={{ color: '#ff4d4d', textAlign: 'center', fontSize: '0.9rem' }}>{error}</p>
        )}

        {/* Show remaining attempts warning */}
        {attemptsRef.current >= 3 && !isLocked && (
          <p style={{ color: '#ff9800', textAlign: 'center', fontSize: '0.8rem', margin: 0 }}>
            ⚠️ {MAX_ATTEMPTS - attemptsRef.current} attempt(s) remaining before lockout
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            type="submit"
            label={isLocked ? 'Locked' : 'Sign In'}
            disabled={form.formState.isSubmitting || isLocked}
          />
        </div>

        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onSwitchToSignUp}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#1db954',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Sign up
          </button>
        </div>
      </div>
    </form>
  );
};
