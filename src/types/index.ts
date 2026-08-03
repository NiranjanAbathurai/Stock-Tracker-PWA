export type AvailabilityStatus = 'available' | 'low' | 'out_of_stock';

export type Tab = 'dashboard' | 'inventory' | 'profile';

export type CatalogItem = {
  id: number;
  name: string;
};

export type CatalogCategory = {
  id: number;
  name: string;
  items: CatalogItem[];
};

export type Product = {
  id: number;
  stockType: string;
  product: string;
  quantity: string;
  expiryDate: string;
  availability: 'Yes' | 'No' | '';
  isExpired?: boolean;
  availability_status?: AvailabilityStatus;
};

export type HomeItem = {
  id: number;
  name: string;
  expanded: boolean;
  filters: {
    availability: 'all' | 'unavailable';
    stockType: string;
  };
  products: Product[];
};
