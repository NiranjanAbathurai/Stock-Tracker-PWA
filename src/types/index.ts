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
