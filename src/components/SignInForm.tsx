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

export const SignInForm = ({ onSubmit, onSwitchToSignUp, error }: SignInFormProps) => {
  const form = useForm<SignInFormValues>({
    defaultValues: { email: '', password: '' },
  });

  const handleSubmit = async (data: SignInFormValues) => {
    await onSubmit(data.email, data.password);
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

        {error && (
          <p style={{ color: '#ff4d4d', textAlign: 'center', fontSize: '0.9rem' }}>{error}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button type="submit" label="Sign In" disabled={form.formState.isSubmitting} />
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
