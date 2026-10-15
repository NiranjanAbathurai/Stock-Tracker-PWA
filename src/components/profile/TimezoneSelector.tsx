import React, { useState, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import { getBrowserTimezone } from '../../services/authService';

/**
 * Common IANA timezones grouped by region.
 * This covers the most populated timezones worldwide.
 */
const COMMON_TIMEZONES: string[] = [
  // Americas
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  // Europe
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Helsinki',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Budapest',
  'Europe/Bucharest',
  'Europe/Athens',
  'Europe/Istanbul',
  'Europe/Moscow',
  // Africa
  'Africa/Cairo',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Africa/Casablanca',
  // Asia
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Tehran',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Calcutta',
  'Asia/Colombo',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Taipei',
  'Asia/Seoul',
  'Asia/Tokyo',
  // Oceania
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Honolulu',
  // UTC
  'UTC',
];

/**
 * Get a human-readable label for a timezone.
 * e.g. "Asia/Kolkata" → "Asia/Kolkata (UTC+5:30)"
 */
function getTimezoneLabel(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    const offset = offsetPart?.value || '';
    // Clean up the timezone name for display
    const displayName = tz.replace(/_/g, ' ');
    return `${displayName} (${offset})`;
  } catch {
    return tz;
  }
}

interface TimezoneSelectorProps {
  currentTimezone: string;
  onTimezoneChange: (tz: string) => void;
}

const TimezoneSelector: React.FC<TimezoneSelectorProps> = ({ currentTimezone, onTimezoneChange }) => {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const browserTimezone = useMemo(() => getBrowserTimezone(), []);

  // Build timezone options with labels, filtered by search
  const filteredTimezones = useMemo(() => {
    // Ensure current timezone and browser timezone are always in the list
    const allTimezones = new Set([...COMMON_TIMEZONES]);
    if (currentTimezone) allTimezones.add(currentTimezone);
    if (browserTimezone) allTimezones.add(browserTimezone);

    const options = Array.from(allTimezones).map(tz => ({
      value: tz,
      label: getTimezoneLabel(tz),
    }));

    // Sort by offset then name
    options.sort((a, b) => a.label.localeCompare(b.label));

    if (!search.trim()) return options;

    const q = search.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [search, currentTimezone, browserTimezone]);

  const handleSelect = async (tz: string) => {
    if (tz === currentTimezone) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ data: { timezone: tz } });
      if (error) throw error;
      onTimezoneChange(tz);
      setMessage({ type: 'success', text: `Timezone updated to ${tz.replace(/_/g, ' ')}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update timezone.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleDetect = () => {
    handleSelect(browserTimezone);
  };

  const currentLabel = currentTimezone ? getTimezoneLabel(currentTimezone) : 'Not set';

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.2rem' }}>🌍</span>
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
              Timezone
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {currentTimezone ? currentTimezone.replace(/_/g, ' ') : 'Not set'}
            </span>
          </div>
        </div>
        <span
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          ▼
        </span>
      </button>

      {/* Expandable Content */}
      {expanded && (
        <div style={{ padding: '0 20px 16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Current timezone display */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              fontSize: '0.85rem',
              color: 'var(--accent-green)',
            }}
          >
            Current: {currentLabel}
          </div>

          {/* Auto-detect button */}
          {browserTimezone !== currentTimezone && (
            <button
              onClick={handleDetect}
              disabled={saving}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid var(--accent-green)',
                background: 'rgba(34, 197, 94, 0.1)',
                color: 'var(--accent-green)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                opacity: saving ? 0.6 : 1,
              }}
            >
              🔍 Auto-detect: {browserTimezone.replace(/_/g, ' ')}
            </button>
          )}

          {/* Search input */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search timezone..."
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />

          {/* Timezone list */}
          <div
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
            }}
          >
            {filteredTimezones.map((tz) => {
              const isSelected = tz.value === currentTimezone;
              return (
                <button
                  key={tz.value}
                  onClick={() => handleSelect(tz.value)}
                  disabled={saving}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 14px',
                    background: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-color)',
                    color: isSelected ? 'var(--accent-green)' : 'var(--text-primary)',
                    fontSize: '0.8rem',
                    textAlign: 'left',
                    cursor: saving ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {isSelected && '✓ '}{tz.label}
                </button>
              );
            })}
            {filteredTimezones.length === 0 && (
              <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
                No timezones match your search.
              </div>
            )}
          </div>

          {/* Message */}
          {message && (
            <p
              style={{
                margin: 0,
                fontSize: '0.8rem',
                color: message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
              }}
            >
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default TimezoneSelector;
