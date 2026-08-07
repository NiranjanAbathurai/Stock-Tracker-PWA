import { supabase } from '../config/supabase';
import type { AvailabilityStatus, Product } from '../types';
import { deriveAvailability, deriveStatusFromAvailability } from '../utils/deriveStatus';

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

// UPDATE a home's name (with ownership check)
export async function updateHomeName(homeId: number, newName: string) {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('homes')
    .update({ name: newName })
    .eq('id', homeId)
    .eq('user_id', user.id) // SECURITY: Only allow updating own homes
    .select()
    .single();
  if (error) throw error;
  return data;
}

// REMOVE a home (with ownership check; products auto-delete via cascade)
export async function removeHome(homeId: number) {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from('homes')
    .delete()
    .eq('id', homeId)
    .eq('user_id', user.id); // SECURITY: Only allow deleting own homes
  if (error) throw error;
  return true;
}

/* ============ PRODUCTS ============ */

// ADD a product to a home (verifies home ownership first)
export async function addProduct(homeId: number, productData: Omit<Product, 'id' | 'isExpired'>) {
  const user = await getCurrentUser();

  // SECURITY: Verify the home belongs to the current user before adding a product
  const { data: homeCheck, error: homeError } = await supabase
    .from('homes')
    .select('id')
    .eq('id', homeId)
    .eq('user_id', user.id)
    .single();

  if (homeError || !homeCheck) {
    throw new Error('Home not found or access denied.');
  }

  // Derive availability from availability_status for consistency
  const status: AvailabilityStatus = productData.availability_status || deriveStatusFromAvailability(productData.availability);
  const productToInsert = {
    home_id: homeId,
    stock_type: productData.stockType,
    product: productData.product,
    quantity: productData.quantity,
    expiry_date: productData.expiryDate || null,
    availability: deriveAvailability(status),
    availability_status: status,
  };
  const { data, error } = await supabase
    .from('products')
    .insert(productToInsert)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// UPDATE a product (with ownership verification)
export async function updateProduct(productId: number, fields: Partial<Product>) {
  const user = await getCurrentUser();

  // SECURITY: Verify ownership via home → user_id join
  const { data: owned } = await supabase
    .from('products')
    .select('id, home_id, homes!inner(user_id)')
    .eq('id', productId)
    .eq('homes.user_id', user.id)
    .maybeSingle();
  if (!owned) throw new Error('Product not found or access denied.');

  const fieldsToUpdate: Record<string, unknown> = {};
  if (fields.stockType !== undefined) fieldsToUpdate.stock_type = fields.stockType;
  if (fields.product !== undefined) fieldsToUpdate.product = fields.product;
  if (fields.quantity !== undefined) fieldsToUpdate.quantity = fields.quantity;
  if (fields.expiryDate !== undefined) fieldsToUpdate.expiry_date = fields.expiryDate || null;

  // Keep availability and availability_status in sync (derivation rule)
  if (fields.availability_status !== undefined) {
    fieldsToUpdate.availability_status = fields.availability_status;
    // Always derive availability from status to maintain invariant
    fieldsToUpdate.availability = deriveAvailability(fields.availability_status);
  } else if (fields.availability !== undefined) {
    fieldsToUpdate.availability = fields.availability;
    // Reverse-derive status from availability for backward compat
    fieldsToUpdate.availability_status = deriveStatusFromAvailability(fields.availability);
  }

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

// REMOVE a product (with ownership verification)
export async function removeProduct(productId: number) {
  const user = await getCurrentUser();

  // SECURITY: Verify ownership via home → user_id join
  const { data: owned } = await supabase
    .from('products')
    .select('id, home_id, homes!inner(user_id)')
    .eq('id', productId)
    .eq('homes.user_id', user.id)
    .maybeSingle();
  if (!owned) throw new Error('Product not found or access denied.');

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);
  if (error) throw error;
  return true;
}
