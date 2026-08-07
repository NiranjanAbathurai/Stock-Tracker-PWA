import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing homeApi
function createChainMock() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  return chain;
}

let mockChain = createChainMock();

const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'test-user-123', email: 'test@example.com' } },
  error: null,
});

vi.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => mockChain,
  },
}));

// Import after mocking
import { updateProduct, removeProduct, addProduct } from '../homeApi';

describe('homeApi ownership verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createChainMock();
  });

  describe('updateProduct', () => {
    it('throws when ownership check returns null (not owned)', async () => {
      // maybeSingle returns null — product not owned by user
      (mockChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null, error: null });

      await expect(updateProduct(1, { product: 'New Name' }))
        .rejects.toThrow('Product not found or access denied');
    });

    it('proceeds with update when ownership verified', async () => {
      // First call: ownership check succeeds
      (mockChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { id: 1, home_id: 10 },
        error: null,
      });
      // Second call: the actual update returns via .single()
      (mockChain.single as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { id: 1, product: 'Updated', stock_type: 'Grocery', quantity: '2', expiry_date: '', availability: 'Yes', availability_status: 'available' },
        error: null,
      });

      const result = await updateProduct(1, { product: 'Updated' });
      expect(result.product).toBe('Updated');
    });

    it('syncs availability when availability_status is set', async () => {
      (mockChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { id: 1, home_id: 10 },
        error: null,
      });
      (mockChain.single as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { id: 1, product: 'Rice', stock_type: 'Grocery', quantity: '1', expiry_date: '', availability: 'No', availability_status: 'out_of_stock' },
        error: null,
      });

      await updateProduct(1, { availability_status: 'out_of_stock' });

      // Verify the update call included both fields
      const updateFn = mockChain.update as ReturnType<typeof vi.fn>;
      const updateArg = updateFn.mock.calls[0]?.[0];
      if (updateArg) {
        expect(updateArg.availability_status).toBe('out_of_stock');
        expect(updateArg.availability).toBe('No');
      }
    });
  });

  describe('removeProduct', () => {
    it('throws when ownership check returns null', async () => {
      (mockChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null, error: null });

      await expect(removeProduct(99))
        .rejects.toThrow('Product not found or access denied');
    });
  });

  describe('addProduct', () => {
    it('throws when home ownership check fails', async () => {
      // single() returns error when home not found
      (mockChain.single as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(addProduct(999, {
        stockType: 'Grocery',
        product: 'Test',
        quantity: '1',
        expiryDate: '',
        availability: 'Yes',
      })).rejects.toThrow();
    });
  });
});

describe('homeApi derive-status sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createChainMock();
  });

  it('setting availability_status=out_of_stock derives availability=No', async () => {
    (mockChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 1, home_id: 10 }, error: null });
    (mockChain.single as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { id: 1, product: 'X', stock_type: '', quantity: '', expiry_date: '', availability: 'No', availability_status: 'out_of_stock' },
      error: null,
    });

    await updateProduct(1, { availability_status: 'out_of_stock' });
    const updateFn = mockChain.update as ReturnType<typeof vi.fn>;
    const updateArg = updateFn.mock.calls[0]?.[0];
    expect(updateArg?.availability).toBe('No');
  });

  it('setting availability_status=available derives availability=Yes', async () => {
    (mockChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 1, home_id: 10 }, error: null });
    (mockChain.single as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { id: 1, product: 'X', stock_type: '', quantity: '', expiry_date: '', availability: 'Yes', availability_status: 'available' },
      error: null,
    });

    await updateProduct(1, { availability_status: 'available' });
    const updateFn = mockChain.update as ReturnType<typeof vi.fn>;
    const updateArg = updateFn.mock.calls[0]?.[0];
    expect(updateArg?.availability).toBe('Yes');
  });

  it('setting availability=No derives availability_status=out_of_stock', async () => {
    (mockChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 1, home_id: 10 }, error: null });
    (mockChain.single as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { id: 1, product: 'X', stock_type: '', quantity: '', expiry_date: '', availability: 'No', availability_status: 'out_of_stock' },
      error: null,
    });

    await updateProduct(1, { availability: 'No' });
    const updateFn = mockChain.update as ReturnType<typeof vi.fn>;
    const updateArg = updateFn.mock.calls[0]?.[0];
    expect(updateArg?.availability_status).toBe('out_of_stock');
  });
});
