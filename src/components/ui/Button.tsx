import type { CSSProperties, ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
};

const styles: Record<string, CSSProperties> = {
  primary: {
    background: '#1db954',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '0.6rem 1.5rem',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  secondary: {
    background: '#444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '0.6rem 1.5rem',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  danger: {
    background: '#e53935',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '0.6rem 1.5rem',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.95rem',
  },
};

export const Button = ({ label, variant = 'primary', fullWidth, style, ...rest }: ButtonProps) => {
  return (
    <button
      style={{
        ...styles[variant],
        ...(fullWidth ? { width: '100%' } : {}),
        ...style,
      }}
      {...rest}
    >
      {label}
    </button>
  );
};
