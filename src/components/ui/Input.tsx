import type { CSSProperties, InputHTMLAttributes } from 'react';
import type { UseFormRegister, RegisterOptions, FieldValues, Path } from 'react-hook-form';

type InputProps<T extends FieldValues> = Omit<InputHTMLAttributes<HTMLInputElement>, 'name'> & {
  label: string;
  name: Path<T>;
  register: UseFormRegister<T>;
  rules?: RegisterOptions<T, Path<T>>;
  error?: string;
  required?: boolean;
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: '6px',
  border: '1px solid #555',
  background: '#222',
  color: '#fff',
  fontSize: '16px',
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: '0.25rem',
  color: '#ccc',
  fontSize: '0.9rem',
  fontWeight: 500,
};

const errorStyle: CSSProperties = {
  color: '#ff4d4d',
  fontSize: '0.8rem',
  marginTop: '0.25rem',
};

export function Input<T extends FieldValues>({
  label,
  name,
  register,
  rules,
  error,
  required,
  style,
  ...rest
}: InputProps<T>) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: '#ff4d4d', marginLeft: '2px' }}>*</span>}
      </label>
      <input
        {...register(name, rules)}
        style={{ ...inputStyle, ...style, ...(error ? { borderColor: '#ff4d4d' } : {}) }}
        {...rest}
      />
      {error && <p style={errorStyle}>{error}</p>}
    </div>
  );
}
