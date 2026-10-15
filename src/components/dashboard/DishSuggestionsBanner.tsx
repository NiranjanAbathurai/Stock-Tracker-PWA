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

// ─── Food Categories (exclude Cleaning, Personal Care, Medicine, Others) ───
const FOOD_CATEGORIES = new Set([
  'grocery', 'vegetables', 'fruits', 'dairy', 'snacks', 'beverages',
  'spices', 'frozen', 'bakery', 'masalas', 'grains & rice', 'pulses & lentils',
]);

function isFoodCategory(stockType: string): boolean {
  if (!stockType) return true; // If no category, include it (might be food)
  return FOOD_CATEGORIES.has(stockType.toLowerCase());
}

// ─── Cache Helpers ───

function hashItems(items: string[]): string {
  return items.sort().join('|').toLowerCase();
}

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

function saveCache(dishes: DishSuggestion[], itemsHash: string): void {
  try {
    const data: CachedSuggestions = { dishes, itemsHash, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable
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

  // Filter to only available FOOD products (exclude Cleaning, Personal Care, Medicine)
  const availableProducts = useMemo(
    () => products.filter(p => {
      if (p.availability === 'No') return false;
      if (p.availability_status === 'out_of_stock') return false;
      if (!isFoodCategory(p.stockType)) return false;
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

    // Call AI API
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        setIsLoading(false);
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
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.warn('[DishSuggestions] API error:', response.status, errData);
        setError(errData.error || `API error ${response.status}`);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      console.log('[DishSuggestions] AI response:', data);

      if (data.dishes && Array.isArray(data.dishes) && data.dishes.length > 0) {
        setSuggestions(data.dishes);
        saveCache(data.dishes, currentHash);
      } else {
        setError('No dishes returned');
      }
    } catch (err) {
      console.warn('[DishSuggestions] Network error:', err);
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [availableItems, currentHash]);

  // Auto-fetch on mount or when items change
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Don't render if no food items
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
            AI is analyzing your {availableItems.length} food items
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && suggestions.length === 0) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(251, 191, 36, 0.08) 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Dish suggestions unavailable
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {error}
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchSuggestions(true)}
          style={{
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.75rem',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Retry
        </button>
      </div>
    );
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
              AI suggestions from your {availableItems.length} food items
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
            }}
            title="Refresh AI suggestions"
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

      {/* Subtle loading indicator when refreshing */}
      {isLoading && suggestions.length > 0 && (
        <div
          style={{
            textAlign: 'center',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            marginTop: '4px',
          }}
        >
          ✨ Refreshing AI suggestions...
        </div>
      )}
    </div>
  );
};

export default DishSuggestionsBanner;
