import { useId } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode;
  className?: string;
}

/** Label + control + error/hint wiring with generated ids (no duplicate ids). */
export function Field({ label, error, hint, required, children, className }: FieldShellProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={['field', className ?? ''].filter(Boolean).join(' ')}>
      <label className="field-label" htmlFor={id}>
        {label}
        {required && (
          <span className="field-required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
      {!error && hint && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
    </div>
  );
}

type InputProps = ComponentPropsWithRef<'input'> & { invalid?: boolean };
type SelectProps = ComponentPropsWithRef<'select'> & { invalid?: boolean };
type TextareaProps = ComponentPropsWithRef<'textarea'> & { invalid?: boolean };

export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      className={['field-control', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select
      className={['field-control', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={['field-control', className ?? ''].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

interface Option {
  value: string;
  label: string;
}

export function SelectField({
  label,
  error,
  hint,
  required,
  options,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
        <Select
          id={id}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
