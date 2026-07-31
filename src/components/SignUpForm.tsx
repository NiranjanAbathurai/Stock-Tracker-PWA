import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { signUpUser } from '../services/authService';

type SignUpFormValues = {
  username: string;
  email: string;
  password: string;
};

type SignUpFormProps = {
  onSwitchToSignIn: () => void;
  onSuccess: () => void;
};

export const SignUpForm = ({ onSwitchToSignIn, onSuccess }: SignUpFormProps) => {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const form = useForm<SignUpFormValues>({
    defaultValues: { username: '', email: '', password: '' },
  });

  const handleSubmit = async (data: SignUpFormValues) => {
    setMessage(null);
    setIsError(false);
    try {
      await signUpUser(data.username, data.email, data.password);
      setMessage('Please confirm your email address to complete sign up.');
      setIsError(false);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign up failed';
      setMessage(errorMessage);
      setIsError(true);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
      <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#1db954', fontSize: '1.25rem' }}>
        Sign Up
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Input<SignUpFormValues>
          label="Username"
          name="username"
          type="text"
          register={form.register}
          rules={{ required: 'Username is required' }}
          error={form.formState.errors.username?.message}
          required
        />

        <Input<SignUpFormValues>
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

        <Input<SignUpFormValues>
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

        {message && (
          <p style={{ color: isError ? '#ff4d4d' : '#1db954', textAlign: 'center', fontSize: '0.9rem' }}>
            {message}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button type="submit" label="Sign Up" disabled={form.formState.isSubmitting} />
        </div>

        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onSwitchToSignIn}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#1db954',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Already have an account? Sign in
          </button>
        </div>
      </div>
    </form>
  );
};
