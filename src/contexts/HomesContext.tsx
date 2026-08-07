import React, { createContext, useState, useEffect, useCallback, useContext, useMemo } from 'react';
import * as api from '../services/homeApi';
import type { AvailabilityStatus, HomeItem, Product } from '../types';

interface HomesContextValue {
  homes: HomeItem[];
  isLoading: boolean;
  error: string | null;
  addHome: (name: string) => Promise<HomeItem>;
  deleteHome: (id: number) => Promise<void>;
  updateHomeName: (id: number, name: string) => Promise<void>;
  toggleHome: (id: number) => void;
  addProduct: (homeId: number, initialData?: Partial<Omit<Product, 'id' | 'isExpired'>>) => Promise<Product>;
  deleteProduct: (homeId: number, productId: number) => Promise<void>;
  updateProduct: (homeId: number, productId: number, fields: Partial<Product>) => Promise<void>;
  updateHomeFilters: (homeId: number, filters: Partial<HomeItem['filters']>) => void;
  reload: () => Promise<void>;
}

const HomesContext = createContext<HomesContextValue | null>(null);

// Temporary ID counter for optimistic inserts (negative to avoid collision with DB IDs)
let tempIdCounter = -1;

export function HomesProvider({ children }: { children: React.ReactNode }) {
  const [homes, setHomes] = useState<HomeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHomes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const homesFromApi = await api.getHomesWithProducts();
      const formattedHomes: HomeItem[] = homesFromApi.map((home: Record<string, unknown>, _idx: number, arr: Record<string, unknown>[]) => ({
        id: home.id as number,
        name: home.name as string,
        expanded: arr.length === 1,
        filters: { availability: 'all' as const, stockType: 'all' },
        products: ((home.products as Array<Record<string, unknown>>) || []).map((p) => {
          const expiryDate = p.expiry_date ? new Date(p.expiry_date as string) : null;
          const isExpired = expiryDate !== null && expiryDate < today;
          const wasAvailable = p.availability === 'Yes';
          const isNowExpiredAndUnavailable = isExpired && wasAvailable;
          // Display-only override: expired items show as unavailable in UI
          // but we do NOT write this back to DB — the expiry-notification cron handles expired items separately
          const availability: 'Yes' | 'No' = isNowExpiredAndUnavailable ? 'No' : (p.availability as 'Yes' | 'No') || 'Yes';

          // Read persisted availability_status from DB; fall back to deriving from availability
          const dbStatus = p.availability_status as AvailabilityStatus | undefined;
          const availabilityStatus: AvailabilityStatus = dbStatus || (availability === 'No' ? 'out_of_stock' : 'available');

          return {
            id: p.id as number,
            stockType: (p.stock_type as string) || '',
            product: (p.product as string) || '',
            quantity: (p.quantity as string) || '',
            expiryDate: (p.expiry_date as string) || '',
            availability,
            availability_status: availabilityStatus,
            isExpired: isNowExpiredAndUnavailable,
          };
        }),
      }));
      setHomes(formattedHomes);
    } catch (err) {
      console.error('Error fetching homes:', err);
      setError('Failed to load your homes. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHomes();
  }, [loadHomes]);

  const addHome = useCallback(async (name: string) => {
    const newHomeFromApi = await api.addHome(name);
    const newHome: HomeItem = {
      id: newHomeFromApi.id,
      name: newHomeFromApi.name,
      expanded: true,
      filters: { availability: 'all', stockType: 'all' },
      products: [],
    };
    setHomes((prev) => [...prev, newHome]);
    return newHome;
  }, []);

  const deleteHome = useCallback(async (id: number) => {
    // Optimistic: remove immediately
    setHomes((prev) => prev.filter((home) => home.id !== id));
    try {
      await api.removeHome(id);
    } catch (err) {
      // Rollback: reload full state on failure
      loadHomes();
      throw err;
    }
  }, [loadHomes]);

  const updateHomeName = useCallback(async (id: number, name: string) => {
    // Optimistic: update name immediately
    setHomes((prev) => prev.map((home) => (home.id === id ? { ...home, name } : home)));
    try {
      await api.updateHomeName(id, name);
    } catch (err) {
      loadHomes();
      throw err;
    }
  }, [loadHomes]);

  const toggleHome = useCallback((id: number) => {
    setHomes((prev) => prev.map((home) => (home.id === id ? { ...home, expanded: !home.expanded } : home)));
  }, []);

  const addProduct = useCallback(async (homeId: number, initialData?: Partial<Omit<Product, 'id' | 'isExpired'>>) => {
    // Check for duplicate product name in the same home
    const productName = (initialData?.product || '').trim().toLowerCase();
    if (productName) {
      const home = homes.find(h => h.id === homeId);
      if (home) {
        const duplicate = home.products.find(
          p => p.product.trim().toLowerCase() === productName
        );
        if (duplicate) {
          throw new Error(`"${initialData?.product}" already exists in this home.`);
        }
      }
    }

    // Optimistic: add with temporary ID immediately
    const tempId = tempIdCounter--;
    const availability = (initialData?.availability || 'Yes') as Product['availability'];
    const optimisticProduct: Product = {
      id: tempId,
      stockType: initialData?.stockType || '',
      product: initialData?.product || '',
      quantity: initialData?.quantity || '',
      expiryDate: initialData?.expiryDate || '',
      availability,
      availability_status: initialData?.availability_status || (availability === 'No' ? 'out_of_stock' : 'available'),
    };

    setHomes((prev) => prev.map((h) =>
      h.id === homeId ? { ...h, products: [...h.products, optimisticProduct] } : h
    ));

    try {
      const newProductData = {
        stockType: initialData?.stockType || '',
        product: initialData?.product || '',
        quantity: initialData?.quantity || '',
        expiryDate: initialData?.expiryDate || '',
        availability: (initialData?.availability || 'Yes') as Product['availability'],
      };
      const newProductFromApi = await api.addProduct(homeId, newProductData);
      const realProduct: Product = {
        id: newProductFromApi.id,
        stockType: newProductFromApi.stock_type || '',
        product: newProductFromApi.product || '',
        quantity: newProductFromApi.quantity || '',
        expiryDate: newProductFromApi.expiry_date || '',
        availability: newProductFromApi.availability || 'Yes',
        availability_status: newProductFromApi.availability_status || 'available'
      };

      // Replace temp ID with real ID from server
      setHomes((prev) => prev.map((h) =>
        h.id === homeId
          ? { ...h, products: h.products.map((p) => p.id === tempId ? realProduct : p) }
          : h
      ));
      return realProduct;
    } catch (err) {
      // Rollback: remove the optimistic product
      setHomes((prev) => prev.map((h) =>
        h.id === homeId
          ? { ...h, products: h.products.filter((p) => p.id !== tempId) }
          : h
      ));
      throw err;
    }
  }, [homes]);

  const deleteProduct = useCallback(async (homeId: number, productId: number) => {
    // Optimistic: remove immediately
    let removedProduct: Product | undefined;
    setHomes((prev) =>
      prev.map((home) => {
        if (home.id === homeId) {
          removedProduct = home.products.find((p) => p.id === productId);
          return { ...home, products: home.products.filter((p) => p.id !== productId) };
        }
        return home;
      })
    );

    try {
      await api.removeProduct(productId);
    } catch (err) {
      // Rollback: re-add the product
      if (removedProduct) {
        const productToRestore = removedProduct;
        setHomes((prev) =>
          prev.map((home) =>
            home.id === homeId
              ? { ...home, products: [...home.products, productToRestore] }
              : home
          )
        );
      }
      throw err;
    }
  }, []);

  const updateProduct = useCallback(async (homeId: number, productId: number, fields: Partial<Product>) => {
    // Check for duplicate product name in the same home
    if (fields.product !== undefined && fields.product.trim()) {
      const home = homes.find(h => h.id === homeId);
      if (home) {
        const duplicate = home.products.find(
          p => p.id !== productId && p.product.trim().toLowerCase() === fields.product!.trim().toLowerCase()
        );
        if (duplicate) {
          throw new Error(`"${fields.product}" already exists in this home.`);
        }
      }
    }

    // Optimistic UI update
    setHomes((prev) =>
      prev.map((home) =>
        home.id === homeId
          ? { ...home, products: home.products.map((p) => (p.id === productId ? { ...p, ...fields } : p)) }
          : home
      )
    );
    try {
      await api.updateProduct(productId, fields);
    } catch (err) {
      console.error('Error updating product:', err);
      // Reload on failure to revert optimistic update
      loadHomes();
      throw err; // Re-throw so callers can handle
    }
  }, [homes, loadHomes]);

  const updateHomeFilters = useCallback((homeId: number, filters: Partial<HomeItem['filters']>) => {
    setHomes((prev) =>
      prev.map((home) =>
        home.id === homeId ? { ...home, filters: { ...home.filters, ...filters } } : home
      )
    );
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value: HomesContextValue = useMemo(() => ({
    homes,
    isLoading,
    error,
    addHome,
    deleteHome,
    updateHomeName,
    toggleHome,
    addProduct,
    deleteProduct,
    updateProduct,
    updateHomeFilters,
    reload: loadHomes,
  }), [homes, isLoading, error, addHome, deleteHome, updateHomeName, toggleHome, addProduct, deleteProduct, updateProduct, updateHomeFilters, loadHomes]);

  return (
    <HomesContext.Provider value={value}>
      {children}
    </HomesContext.Provider>
  );
}

export function useHomesContext(): HomesContextValue {
  const context = useContext(HomesContext);
  if (!context) {
    throw new Error('useHomesContext must be used within a HomesProvider');
  }
  return context;
}

export default HomesContext;
