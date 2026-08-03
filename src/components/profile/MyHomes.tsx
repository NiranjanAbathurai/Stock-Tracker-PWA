import React, { useState } from 'react';
import { useHomes } from '../../hooks/useHomes';

const MyHomes: React.FC = () => {
  const { homes, isLoading, addHome, deleteHome } = useHomes();
  const [newHomeName, setNewHomeName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleAddHome = async () => {
    const name = newHomeName.trim();
    if (!name) return;
    setError(null);
    setIsAdding(true);
    try {
      await addHome(name);
      setNewHomeName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add home');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteHome = async (id: number) => {
    setError(null);
    try {
      await deleteHome(id);
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete home');
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}
    >
      {/* Header - clickable to expand */}
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
          <span style={{ fontSize: '1.2rem' }}>🏠</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            My Homes
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              background: 'var(--bg-input)',
              color: 'var(--text-secondary)',
              padding: '2px 8px',
              borderRadius: '10px',
            }}
          >
            {homes.length}
          </span>
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
        <div style={{ padding: '0 20px 16px 20px' }}>
          {isLoading ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              Loading homes...
            </p>
          ) : (
            <>
              {/* Homes List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {homes.map((home) => (
                  <div
                    key={home.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--bg-input)',
                      borderRadius: '10px',
                    }}
                  >
                    <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      {home.name}
                    </span>
                    {deleteConfirmId === home.id ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleDeleteHome(home.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'var(--accent-red)',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(home.id)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--accent-red)',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                        aria-label={`Delete ${home.name}`}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
                {homes.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, textAlign: 'center' }}>
                    No homes added yet.
                  </p>
                )}
              </div>

              {/* Add Home Input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newHomeName}
                  onChange={(e) => setNewHomeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddHome()}
                  placeholder="New home name..."
                  style={{
                    flex: 1,
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
                <button
                  onClick={handleAddHome}
                  disabled={isAdding || !newHomeName.trim()}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: newHomeName.trim() ? 'var(--accent-green)' : 'var(--bg-input)',
                    color: newHomeName.trim() ? '#fff' : 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: newHomeName.trim() ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    opacity: isAdding ? 0.6 : 1,
                  }}
                >
                  {isAdding ? '...' : 'Add'}
                </button>
              </div>

              {/* Error */}
              {error && (
                <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', margin: '8px 0 0 0' }}>
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MyHomes;
