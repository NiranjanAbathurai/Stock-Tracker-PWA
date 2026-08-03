import React from 'react';

interface CategoryTabsProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({ categories, activeCategory, onCategoryChange }) => {
  const allCategories = ['All', ...categories];

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      padding: '4px 0',
      scrollbarWidth: 'none',
    }}>
      {allCategories.map((category) => {
        const isActive = category === activeCategory;
        return (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            style={{
              padding: '6px 14px',
              borderRadius: '16px',
              border: isActive ? '1.5px solid var(--accent-green)' : '1.5px solid var(--border-color)',
              background: isActive ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
              color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
            }}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
};

export default CategoryTabs;
