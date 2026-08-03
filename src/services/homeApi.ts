import { supabase } from '../config/supabase';
import type { Product } from '../types';

// Helper to get the current user
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not logged in');
  return user;
}

/* ============ HOMES ============ */

// GET all homes of the logged-in user with their products
export async function getHomesWithProducts() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('homes')
    .select('*, products(*)')
    .eq('user_id', user.id)
    .order('id', { ascending: true })
    .order('id', { ascending: true, referencedTable: 'products' });

  if (error) throw error;
  return data;
}

// ADD a home
export async function addHome(name: string) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('homes')
    .insert({ user_id: user.id, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// UPDATE a home's name
export async function updateHomeName(homeId: number, newName: string) {
  const { data, error } = await supabase
    .from('homes')
    .update({ name: newName })
    .eq('id', homeId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// REMOVE a home (its products should auto-delete via cascade in DB setup)
export async function removeHome(homeId: number) {
  const { error } = await supabase
    .from('homes')
    .delete()
    .eq('id', homeId);
  if (error) throw error;
  return true;
}

/* ============ PRODUCTS ============ */

// ADD a product to a home
export async function addProduct(homeId: number, productData: Omit<Product, 'id' | 'isExpired'>) {
  const productToInsert = {
    home_id: homeId,
    stock_type: productData.stockType,
    product: productData.product,
    quantity: productData.quantity,
    expiry_date: productData.expiryDate || null,
    availability: productData.availability,
  };
  const { data, error } = await supabase
    .from('products')
    .insert(productToInsert)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// UPDATE a product
export async function updateProduct(productId: number, fields: Partial<Product>) {
  const fieldsToUpdate: Record<string, unknown> = {};
  if (fields.stockType !== undefined) fieldsToUpdate.stock_type = fields.stockType;
  if (fields.product !== undefined) fieldsToUpdate.product = fields.product;
  if (fields.quantity !== undefined) fieldsToUpdate.quantity = fields.quantity;
  if (fields.expiryDate !== undefined) fieldsToUpdate.expiry_date = fields.expiryDate || null;
  if (fields.availability !== undefined) fieldsToUpdate.availability = fields.availability;

  const { data, error } = await supabase
    .from('products')
    .update(fieldsToUpdate)
    .eq('id', productId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ADD a new item to the catalog (under a category)
export async function addCatalogItem(categoryId: number, itemName: string) {
  const { data, error } = await supabase
    .from('items')
    .insert({ category_id: categoryId, name: itemName })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// REMOVE a product
export async function removeProduct(productId: number) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);
  if (error) throw error;
  return true;
}
