import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

// ─── Food Categories ───
const FOOD_CATEGORIES = new Set([
  'grocery', 'vegetables', 'fruits', 'dairy', 'snacks', 'beverages',
  'spices', 'frozen', 'bakery', 'masalas', 'grains & rice', 'pulses & lentils',
]);

function isFoodCategory(stockType: string): boolean {
  if (!stockType) return true;
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
  } catch { /* ignore */ }
}

// ─── Component ───

interface DishSuggestionsBannerProps {
  products: Product[];
}

const DishSuggestionsBanner: React.FC<DishSuggestionsBannerProps> = ({ products }) => {
  const [suggestions, setSuggestions] = useState<DishSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [selectedDish, setSelectedDish] = useState<DishSuggestion | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userInteractedRef = useRef(false);

  // Filter to only available FOOD products
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
        setError('Rate limited');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.warn('[DishSuggestions] API error:', response.status, errData);
        setError(errData.error || `Error ${response.status}`);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      if (data.dishes && Array.isArray(data.dishes) && data.dishes.length > 0) {
        setSuggestions(data.dishes);
        saveCache(data.dishes, currentHash);
        setActiveSlide(0);
      } else {
        setError('No dishes returned');
      }
    } catch {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [availableItems, currentHash]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // ─── Auto-scroll every 2 seconds ───
  const top3 = useMemo(() => suggestions.slice(0, 3), [suggestions]);

  useEffect(() => {
    if (top3.length <= 1 || showAll || selectedDish) return;

    autoScrollRef.current = setInterval(() => {
      if (userInteractedRef.current) return; // Pause auto-scroll if user swiped
      if (!carouselRef.current) return;

      const nextSlide = (activeSlide + 1) % top3.length;
      const cardWidth = carouselRef.current.offsetWidth * 0.82;
      carouselRef.current.scrollTo({ left: nextSlide * cardWidth, behavior: 'smooth' });
      setActiveSlide(nextSlide);
    }, 2000);

    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    };
  }, [top3.length, activeSlide, showAll, selectedDish]);

  // Handle manual scroll
  const handleScroll = useCallback(() => {
    if (!carouselRef.current) return;
    userInteractedRef.current = true;
    const scrollLeft = carouselRef.current.scrollLeft;
    const cardWidth = carouselRef.current.offsetWidth * 0.82;
    const newSlide = Math.round(scrollLeft / cardWidth);
    setActiveSlide(Math.min(newSlide, top3.length - 1));

    // Resume auto-scroll after 5 seconds of no interaction
    setTimeout(() => { userInteractedRef.current = false; }, 5000);
  }, [top3.length]);

  if (availableItems.length === 0) return null;

  // Loading state
  if (isLoading && suggestions.length === 0) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(251, 191, 36, 0.10) 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          padding: '16px',
          height: '100px',
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
            🍳 Finding dishes...
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Analyzing {availableItems.length} food items
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
          background: 'rgba(239, 68, 68, 0.06)',
          borderRadius: '14px',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>⚠️ {error}</div>
        <button
          onClick={() => fetchSuggestions(true)}
          style={{
            background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px',
            padding: '4px 10px', fontSize: '0.7rem', color: 'var(--text-primary)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  // ─── Recipe Detail Popup ───
  if (selectedDish) {
    return (
      <>
        {/* Backdrop */}
        <div
          onClick={() => setSelectedDish(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 999,
          }}
        />
        {/* Popup */}
        <div
          style={{
            position: 'fixed',
            bottom: 0, left: 0, right: 0,
            background: 'var(--bg-primary)',
            borderRadius: '20px 20px 0 0',
            padding: '24px 20px 32px',
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto',
            animation: 'slideUp 0.3s ease',
          }}
        >
          {/* Handle bar */}
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--bg-input)', margin: '0 auto 16px' }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div
              style={{
                width: '56px', height: '56px', borderRadius: '14px',
                background: 'rgba(34, 197, 94, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem', flexShrink: 0,
              }}
            >
              {selectedDish.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {selectedDish.name}
              </h2>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '0.72rem', color: 'var(--text-secondary)',
                    background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '6px',
                  }}
                >
                  {selectedDish.category}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem', fontWeight: 700,
                    color: selectedDish.match_score >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)',
                    background: selectedDish.match_score >= 70 ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
                    padding: '2px 8px', borderRadius: '6px',
                  }}
                >
                  {selectedDish.match_score}% match
                </span>
              </div>
            </div>
          </div>

          {/* Cooking Tip */}
          {selectedDish.quick_tip && (
            <div
              style={{
                background: 'var(--bg-card)', borderRadius: '12px', padding: '14px',
                marginBottom: '14px',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-green)', marginBottom: '6px' }}>
                💡 Cooking Tip
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {selectedDish.quick_tip}
              </div>
            </div>
          )}

          {/* Ingredients Used */}
          {selectedDish.ingredients_used.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                🥘 Ingredients from your stock
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedDish.ingredients_used.map((item, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.8rem', color: 'var(--accent-green)',
                      background: 'rgba(34, 197, 94, 0.12)',
                      padding: '4px 12px', borderRadius: '8px',
                    }}
                  >
                    ✓ {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={() => setSelectedDish(null)}
            style={{
              width: '100%', padding: '12px', borderRadius: '12px',
              border: 'none', background: 'var(--bg-card)',
              color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', marginTop: '4px',
            }}
          >
            Close
          </button>
        </div>

        {/* Slide-up animation */}
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
      </>
    );
  }

  // ─── Show All View ───
  if (showAll) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(251, 191, 36, 0.10) 100%)',
          borderRadius: '16px', border: '1px solid rgba(34, 197, 94, 0.25)', padding: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            🍳 All Suggestions ({suggestions.length})
          </h3>
          <button
            onClick={() => setShowAll(false)}
            style={{ background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {suggestions.map((dish, index) => (
            <div key={`${dish.name}-${index}`} onClick={() => setSelectedDish(dish)} style={{ cursor: 'pointer' }}>
              <DishCompactCard dish={dish} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Carousel View (Top 3 with auto-scroll) ───
  return (
    <div style={{ marginTop: '4px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '1rem' }}>🍳</span>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            What can you cook?
          </h3>
        </div>
        {suggestions.length > 3 && (
          <button
            onClick={() => setShowAll(true)}
            style={{
              background: 'none', border: 'none', color: 'var(--accent-green)',
              fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0',
            }}
          >
            Show All ({suggestions.length}) →
          </button>
        )}
      </div>

      {/* Swipeable Carousel with auto-scroll */}
      <div
        ref={carouselRef}
        onScroll={handleScroll}
        style={{
          display: 'flex', gap: '10px', overflowX: 'auto',
          scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', msOverflowStyle: 'none', paddingBottom: '6px',
        }}
      >
        {top3.map((dish, index) => (
          <div
            key={`${dish.name}-${index}`}
            onClick={() => setSelectedDish(dish)}
            style={{
              scrollSnapAlign: 'start', minWidth: '80%', maxWidth: '80%',
              flexShrink: 0, cursor: 'pointer',
            }}
          >
            <DishCarouselCard dish={dish} />
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      {top3.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '6px' }}>
          {top3.map((_, index) => (
            <div
              key={index}
              style={{
                width: activeSlide === index ? '16px' : '6px', height: '6px',
                borderRadius: '3px',
                background: activeSlide === index ? 'var(--accent-green)' : 'var(--bg-input)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          ✨ Refreshing...
        </div>
      )}
    </div>
  );
};

// ─── Carousel Card (100px min height, clickable) ───

const DishCarouselCard: React.FC<{ dish: DishSuggestion }> = ({ dish }) => (
  <div
    style={{
      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(251, 191, 36, 0.08) 100%)',
      borderRadius: '14px',
      border: '1px solid rgba(34, 197, 94, 0.2)',
      padding: '14px',
      minHeight: '100px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '6px',
    }}
  >
    {/* Top row: emoji + name + score */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div
        style={{
          width: '44px', height: '44px', borderRadius: '11px',
          background: 'rgba(34, 197, 94, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', flexShrink: 0,
        }}
      >
        {dish.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {dish.name}
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
          {dish.category}
        </div>
      </div>
      <div
        style={{
          fontSize: '0.72rem', fontWeight: 700,
          color: dish.match_score >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)',
          background: dish.match_score >= 70 ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
          padding: '3px 8px', borderRadius: '8px', flexShrink: 0,
        }}
      >
        {dish.match_score}%
      </div>
    </div>

    {/* Tip (single line) */}
    {dish.quick_tip && (
      <div
        style={{
          fontSize: '0.7rem', color: 'var(--text-secondary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          paddingLeft: '54px',
        }}
      >
        💡 {dish.quick_tip}
      </div>
    )}
  </div>
);

// ─── Compact Card (for Show All list) ───

const DishCompactCard: React.FC<{ dish: DishSuggestion }> = ({ dish }) => (
  <div
    style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 12px', borderRadius: '12px', background: 'var(--bg-card)',
    }}
  >
    <div
      style={{
        width: '36px', height: '36px', borderRadius: '9px',
        background: 'rgba(34, 197, 94, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.2rem', flexShrink: 0,
      }}
    >
      {dish.emoji}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {dish.name}
      </div>
      <div
        style={{
          fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '1px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {dish.quick_tip || dish.category}
      </div>
    </div>
    <div
      style={{
        fontSize: '0.68rem', fontWeight: 600,
        color: dish.match_score >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)',
        background: dish.match_score >= 70 ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)',
        padding: '2px 7px', borderRadius: '6px', flexShrink: 0,
      }}
    >
      {dish.match_score}%
    </div>
  </div>
);

export default DishSuggestionsBanner;
