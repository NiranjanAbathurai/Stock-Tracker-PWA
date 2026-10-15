import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { supabase } from '../../config/supabase';
import type { Product } from '../../types';

// ─── Types ───

interface DishSuggestion {
  name: string;
  emoji: string;
  category: string;
  ingredients_used: string[];
  match_score: number;
  quick_tip: string;
}

interface CachedSuggestions {
  dishes: DishSuggestion[];
  itemsHash: string;
  timestamp: number;
}

const CACHE_KEY = 'dish_suggestions_cache';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── Helpers ───

/** Create a simple hash of item names to detect inventory changes */
function hashItems(items: string[]): string {
  return items.sort().join('|').toLowerCase();
}

/** Load cached suggestions from localStorage */
function loadCache(): CachedSuggestions | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedSuggestions = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

/** Save suggestions to localStorage cache */
function saveCache(dishes: DishSuggestion[], itemsHash: string): void {
  try {
    const data: CachedSuggestions = { dishes, itemsHash, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

// ─── Component ───

interface DishSuggestionsBannerProps {
  products: Product[];
}

const DishSuggestionsBanner: React.FC<DishSuggestionsBannerProps> = ({ products }) => {
  const [suggestions, setSuggestions] = useState<DishSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter to only available products
  const availableProducts = useMemo(
    () => products.filter(p => {
      if (p.availability === 'No') return false;
      if (p.availability_status === 'out_of_stock') return false;
      return true;
    }),
    [products]
  );

  const availableItems = useMemo(
    () => availableProducts.map(p => p.product).filter(Boolean),
    [availableProducts]
  );

  const currentHash = useMemo(() => hashItems(availableItems), [availableItems]);

  const fetchSuggestions = useCallback(async (forceRefresh = false) => {
    if (availableItems.length === 0) {
      setSuggestions([]);
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = loadCache();
      if (cached && cached.itemsHash === currentHash && cached.dishes.length > 0) {
        setSuggestions(cached.dishes);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch('/.netlify/functions/suggest-dishes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ items: availableItems }),
      });

      if (response.status === 429) {
        setError('Rate limited — try again later');
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setError(errData.error || 'Failed to get suggestions');
        return;
      }

      const data = await response.json();
      if (data.dishes && Array.isArray(data.dishes)) {
        setSuggestions(data.dishes);
        saveCache(data.dishes, currentHash);
      }
    } catch (err) {
      setError('Network error — check your connection');
    } finally {
      setIsLoading(false);
    }
  }, [availableItems, currentHash]);

  // Auto-fetch on mount or when items change
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Don't render if no items
  if (availableItems.length === 0) return null;

  // Loading state
  if (isLoading && suggestions.length === 0) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(251, 191, 36, 0.10) 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            border: '2.5px solid var(--bg-input)',
            borderTopColor: 'var(--accent-green)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            flexShrink: 0,
          }}
        />
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            🍳 Finding dishes you can cook...
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            AI is analyzing your {availableItems.length} available items
          </div>
        </div>
      </div>
    );
  }

  // Error state (but still show cached suggestions if available)
  if (error && suggestions.length === 0) {
    return null; // Silently hide if no suggestions and error
  }

  if (suggestions.length === 0) return null;

  const displayedSuggestions = isExpanded ? suggestions : suggestions.slice(0, 3);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(251, 191, 36, 0.10) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(34, 197, 94, 0.25)',
        padding: '16px',
        marginTop: '4px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.3rem' }}>🍳</span>
          <div>
            <h3
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              What can you cook?
            </h3>
            <p
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                margin: '2px 0 0 0',
              }}
            >
              AI suggestions from your {availableItems.length} items
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Refresh button */}
          <button
            onClick={() => fetchSuggestions(true)}
            disabled={isLoading}
            style={{
              background: 'none',
              border: 'none',
              cursor: isLoading ? 'default' : 'pointer',
              fontSize: '1rem',
              padding: '4px',
              opacity: isLoading ? 0.5 : 1,
              transition: 'transform 0.3s ease',
              transform: isLoading ? 'rotate(360deg)' : 'none',
            }}
            title="Refresh suggestions"
          >
            🔄
          </button>
          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--accent-green)',
              fontWeight: 600,
              background: 'rgba(34, 197, 94, 0.15)',
              padding: '3px 8px',
              borderRadius: '10px',
            }}
          >
            {suggestions.length} dishes
          </span>
        </div>
      </div>

      {/* Dish Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {displayedSuggestions.map((dish, index) => (
          <div
            key={`${dish.name}-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '12px',
              background: 'var(--bg-card)',
              transition: 'transform 0.15s ease',
            }}
          >
            {/* Emoji */}
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(34, 197, 94, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
                flexShrink: 0,
              }}
            >
              {dish.emoji}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {dish.name}
              </div>
              <div
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-secondary)',
                  marginTop: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {dish.quick_tip || dish.ingredients_used.join(', ')}
              </div>
            </div>

            {/* Match Badge */}
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: dish.match_score >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)',
                background: dish.match_score >= 70
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(251, 191, 36, 0.12)',
                padding: '3px 8px',
                borderRadius: '8px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {dish.match_score}%
            </div>

            {/* Category Tag */}
            <div
              style={{
                fontSize: '0.6rem',
                color: 'var(--text-secondary)',
                background: 'var(--bg-primary)',
                padding: '2px 6px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {dish.category}
            </div>
          </div>
        ))}
      </div>

      {/* Show More / Less */}
      {suggestions.length > 3 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            width: '100%',
            padding: '8px',
            marginTop: '8px',
            borderRadius: '10px',
            border: 'none',
            background: 'transparent',
            color: 'var(--accent-green)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          {isExpanded ? '▲ Show Less' : `▼ Show ${suggestions.length - 3} More Dishes`}
        </button>
      )}

      {/* Subtle loading indicator when refreshing with existing data */}
      {isLoading && suggestions.length > 0 && (
        <div
          style={{
            textAlign: 'center',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            marginTop: '4px',
          }}
        >
          Refreshing suggestions...
        </div>
      )}
    </div>
  );
};

export default DishSuggestionsBanner;
