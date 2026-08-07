import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { HomesProvider, useHomesContext } from '../HomesContext';

// Mock the homeApi module
vi.mock('../../services/homeApi', () => ({
  getHomesWithProducts: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: 'Home 1',
      products: [
        { id: 101, stock_type: 'Grocery', product: 'Rice', quantity: '5kg', expiry_date: '2027-01-01', availability: 'Yes', availability_status: 'available' },
        { id: 102, stock_type: 'Dairy', product: 'Milk', quantity: '1L', expiry_date: '2026-08-10', availability: 'Yes', availability_status: 'available' },
      ],
    },
  ]),
  addHome: vi.fn().mockResolvedValue({ id: 2, name: 'New Home' }),
  removeHome: vi.fn().mockResolvedValue(true),
  updateHomeName: vi.fn().mockResolvedValue({ id: 1, name: 'Updated' }),
  addProduct: vi.fn().mockResolvedValue({
    id: 201,
    stock_type: 'Grocery',
    product: 'Sugar',
    quantity: '1kg',
    expiry_date: '',
    availability: 'Yes',
    availability_status: 'available',
  }),
  removeProduct: vi.fn().mockResolvedValue(true),
  updateProduct: vi.fn().mockResolvedValue({
    id: 101,
    stock_type: 'Grocery',
    product: 'Rice',
    quantity: '10kg',
    expiry_date: '2027-01-01',
    availability: 'Yes',
    availability_status: 'available',
  }),
}));

import * as api from '../../services/homeApi';

function wrapper({ children }: { children: React.ReactNode }) {
  return <HomesProvider>{children}</HomesProvider>;
}

describe('HomesContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads homes on mount', async () => {
    const { result } = renderHook(() => useHomesContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.homes).toHaveLength(1);
    expect(result.current.homes[0].name).toBe('Home 1');
    expect(result.current.homes[0].products).toHaveLength(2);
  });

  it('auto-expands when only one home exists', async () => {
    const { result } = renderHook(() => useHomesContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.homes[0].expanded).toBe(true);
  });

  describe('duplicate detection', () => {
    it('throws when adding a product with duplicate name', async () => {
      const { result } = renderHook(() => useHomesContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Try to add "Rice" which already exists
      await expect(
        act(async () => {
          await result.current.addProduct(1, { product: 'Rice', stockType: 'Grocery', quantity: '2kg' });
        })
      ).rejects.toThrow('"Rice" already exists in this home');
    });

    it('throws when updating product name to an existing name', async () => {
      const { result } = renderHook(() => useHomesContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Try to rename product 102 (Milk) to "Rice" which already exists
      await expect(
        act(async () => {
          await result.current.updateProduct(1, 102, { product: 'Rice' });
        })
      ).rejects.toThrow('"Rice" already exists in this home');
    });

    it('allows case-insensitive duplicate detection', async () => {
      const { result } = renderHook(() => useHomesContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.addProduct(1, { product: 'rice', stockType: 'Grocery', quantity: '1kg' });
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('optimistic updates', () => {
    it('addProduct shows item immediately with temp ID', async () => {
      const { result } = renderHook(() => useHomesContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Start adding — should appear immediately
      let addPromise: Promise<unknown>;
      act(() => {
        addPromise = result.current.addProduct(1, { product: 'Sugar', stockType: 'Grocery', quantity: '1kg' });
      });

      // Product should appear optimistically (with temp negative ID)
      const products = result.current.homes[0].products;
      const sugar = products.find(p => p.product === 'Sugar');
      expect(sugar).toBeDefined();
      expect(sugar!.id).toBeLessThan(0); // Temp ID is negative

      // Wait for API to resolve
      await act(async () => {
        await addPromise;
      });

      // Now should have real ID
      const updatedProducts = result.current.homes[0].products;
      const realSugar = updatedProducts.find(p => p.product === 'Sugar');
      expect(realSugar).toBeDefined();
      expect(realSugar!.id).toBe(201); // Real ID from API
    });

    it('addProduct rolls back on API failure', async () => {
      vi.mocked(api.addProduct).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useHomesContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCount = result.current.homes[0].products.length;

      await expect(
        act(async () => {
          await result.current.addProduct(1, { product: 'Butter', stockType: 'Dairy', quantity: '200g' });
        })
      ).rejects.toThrow('Network error');

      // Should be rolled back
      expect(result.current.homes[0].products.length).toBe(initialCount);
    });

    it('deleteProduct removes item immediately', async () => {
      const { result } = renderHook(() => useHomesContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.deleteProduct(1, 101); // Remove Rice
      });

      // Should be gone immediately (optimistic)
      const rice = result.current.homes[0].products.find(p => p.id === 101);
      expect(rice).toBeUndefined();
    });

    it('deleteProduct rolls back on API failure', async () => {
      vi.mocked(api.removeProduct).mockRejectedValueOnce(new Error('Server error'));

      const { result } = renderHook(() => useHomesContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.deleteProduct(1, 101);
        })
      ).rejects.toThrow('Server error');

      // Should be restored
      const rice = result.current.homes[0].products.find(p => p.id === 101);
      expect(rice).toBeDefined();
    });

    it('updateProduct applies optimistically and rolls back on failure', async () => {
      vi.mocked(api.updateProduct).mockRejectedValueOnce(new Error('Update failed'));
      // Mock reload to restore original state
      vi.mocked(api.getHomesWithProducts).mockResolvedValueOnce([
        {
          id: 1,
          name: 'Home 1',
          products: [
            { id: 101, stock_type: 'Grocery', product: 'Rice', quantity: '5kg', expiry_date: '2027-01-01', availability: 'Yes', availability_status: 'available' },
            { id: 102, stock_type: 'Dairy', product: 'Milk', quantity: '1L', expiry_date: '2026-08-10', availability: 'Yes', availability_status: 'available' },
          ],
        },
      ]);

      const { result } = renderHook(() => useHomesContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.updateProduct(1, 101, { quantity: '99kg' });
        })
      ).rejects.toThrow('Update failed');

      // After reload, should be back to original
      await waitFor(() => {
        const rice = result.current.homes[0]?.products.find(p => p.id === 101);
        expect(rice?.quantity).toBe('5kg');
      });
    });
  });
});
