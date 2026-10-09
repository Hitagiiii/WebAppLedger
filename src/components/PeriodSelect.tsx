import { useState } from 'react';

import { Field, Input, SelectField } from './ui/Field';
import type { PeriodKey, PeriodSelection } from '../types';

interface PeriodSelectProps {
  value: PeriodSelection;
  onChange: (next: PeriodSelection) => void;
  label?: string;
}

const OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Previous month' },
  { value: 'thisYear', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

/** Shared reporting-period picker used by dashboard, analytics and reports. */
export default function PeriodSelect({ value, onChange, label = 'Reporting period' }: PeriodSelectProps) {
  const [touched, setTouched] = useState(false);
  const customReady = Boolean(value.from && value.to && value.from <= value.to);

  return (
    <>
      <SelectField
        label={label}
        value={value.key}
        onChange={(v) => onChange({ key: v as PeriodKey, from: value.from, to: value.to })}
        options={OPTIONS}
      />
      {value.key === 'custom' && (
        <>
          <Field label="From" error={touched && !value.from ? 'Required' : undefined}>
            {({ id }) => (
              <Input
                id={id}
                type="date"
                value={value.from ?? ''}
                onChange={(e) => {
                  setTouched(true);
                  onChange({ ...value, from: e.target.value });
                }}
              />
            )}
          </Field>
          <Field
            label="To"
            error={
              touched && !value.to
                ? 'Required'
                : touched && value.from && value.to && value.from > value.to
                  ? 'From must be before To'
                  : undefined
            }
          >
            {({ id }) => (
              <Input
                id={id}
                type="date"
                value={value.to ?? ''}
                onChange={(e) => {
                  setTouched(true);
                  onChange({ ...value, to: e.target.value });
                }}
              />
            )}
          </Field>
          {!customReady && touched && (
            <span className="field-hint" role="status">
              Choose both dates to apply the range.
            </span>
          )}
        </>
      )}
    </>
  );
}
