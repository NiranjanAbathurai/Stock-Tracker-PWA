import React, { useState, useEffect } from 'react';

interface ExpiryDatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  label?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Custom Expiry Date Picker that shows Year → Month → Day selection.
 * Fixes the issue where native date picker jumps to current month when selecting a year.
 */
const ExpiryDatePicker: React.FC<ExpiryDatePickerProps> = ({ value, onChange, label = 'Expiry Date' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [pickerStep, setPickerStep] = useState<'year' | 'month' | 'day'>('year');

  // Parse initial value
  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        setSelectedYear(parseInt(parts[0]));
        setSelectedMonth(parseInt(parts[1]) - 1); // 0-indexed
        setSelectedDay(parseInt(parts[2]));
      }
    }
  }, []);

  // Generate year options (current year to +10 years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear + i);

  // Generate days for selected month/year
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setPickerStep('month');
  };

  const handleMonthSelect = (monthIndex: number) => {
    setSelectedMonth(monthIndex);
    setPickerStep('day');
  };

  const handleDaySelect = (day: number) => {
    setSelectedDay(day);
    if (selectedYear !== null && selectedMonth !== null) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      onChange(dateStr);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedYear(null);
    setSelectedMonth(null);
    setSelectedDay(null);
    onChange('');
    setIsOpen(false);
  };

  const openPicker = () => {
    setPickerStep('year');
    setIsOpen(true);
  };

  // Format display value
  const displayValue = value
    ? (() => {
        const parts = value.split('-');
        if (parts.length === 3) {
          const m = parseInt(parts[1]) - 1;
          return `${parts[2]} ${MONTHS[m]?.substring(0, 3)} ${parts[0]}`;
        }
        return value;
      })()
    : '';

  return (
    <div style={{ position: 'relative' }}>
      <label
        style={{
          display: 'block',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          marginBottom: '6px',
        }}
      >
        {label}
      </label>

      {/* Display input (tap to open picker) */}
      <div
        onClick={openPicker}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-input)',
          color: displayValue ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontSize: '0.9rem',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{displayValue || 'Select expiry date...'}</span>
        <span style={{ fontSize: '1rem' }}>📅</span>
      </div>

      {/* Clear button (if value exists) */}
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleClear(); }}
          style={{
            position: 'absolute',
            right: '36px',
            top: '50%',
            transform: 'translateY(25%)',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          ✕
        </button>
      )}

      {/* Picker Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1100,
            }}
          />

          {/* Picker Panel */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              borderRadius: '16px 16px 0 0',
              padding: '20px',
              paddingBottom: '32px',
              zIndex: 1101,
              maxHeight: '60vh',
              overflowY: 'auto',
              animation: 'slideUp 0.2s ease',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>
                {pickerStep === 'year' && 'Select Year'}
                {pickerStep === 'month' && `Select Month (${selectedYear})`}
                {pickerStep === 'day' && `Select Day (${MONTHS[selectedMonth!]?.substring(0, 3)} ${selectedYear})`}
              </h4>
              {pickerStep !== 'year' && (
                <button
                  type="button"
                  onClick={() => setPickerStep(pickerStep === 'day' ? 'month' : 'year')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-green)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ← Back
                </button>
              )}
            </div>

            {/* Year Grid */}
            {pickerStep === 'year' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => handleYearSelect(year)}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: year === selectedYear ? '2px solid var(--accent-green)' : '1px solid var(--border-color)',
                      background: year === selectedYear ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-input)',
                      color: year === selectedYear ? 'var(--accent-green)' : 'var(--text-primary)',
                      fontSize: '0.9rem',
                      fontWeight: year === selectedYear ? 600 : 400,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}

            {/* Month Grid */}
            {pickerStep === 'month' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {MONTHS.map((month, idx) => (
                  <button
                    key={month}
                    type="button"
                    onClick={() => handleMonthSelect(idx)}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: idx === selectedMonth ? '2px solid var(--accent-green)' : '1px solid var(--border-color)',
                      background: idx === selectedMonth ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-input)',
                      color: idx === selectedMonth ? 'var(--accent-green)' : 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: idx === selectedMonth ? 600 : 400,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {month.substring(0, 3)}
                  </button>
                ))}
              </div>
            )}

            {/* Day Grid */}
            {pickerStep === 'day' && selectedYear !== null && selectedMonth !== null && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                {Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => i + 1).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDaySelect(day)}
                    style={{
                      padding: '10px 4px',
                      borderRadius: '8px',
                      border: day === selectedDay ? '2px solid var(--accent-green)' : '1px solid var(--border-color)',
                      background: day === selectedDay ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-input)',
                      color: day === selectedDay ? 'var(--accent-green)' : 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: day === selectedDay ? 600 : 400,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ExpiryDatePicker;
