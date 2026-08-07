import { describe, it, expect } from 'vitest';
import { deriveStatusFromAvailability } from '../derive-status.js';

/**
 * Tests the notification priority logic from smart-reminder.js.
 * We extract and test the decision logic without needing Supabase or web-push.
 */

// Replicate the priority decision logic from smart-reminder.js
function determineNotification(products, { isMorning, isAfternoon, isEvening }) {
  const today = new Date().toISOString().split('T')[0];

  const expiringSoon = [];
  const expired = [];
  const outOfStock = [];
  const lowStock = [];
  const availableFood = [];

  for (const p of products) {
    if (p.expiry_date) {
      const expiryDate = new Date(p.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        expired.push(p);
      } else if (daysUntilExpiry <= 3) {
        expiringSoon.push({ ...p, daysLeft: daysUntilExpiry });
      }
    }

    // Use the shared derive-status module (the fix!)
    const status = p.availability_status || deriveStatusFromAvailability(p.availability || 'Yes');
    if (status === 'out_of_stock') {
      outOfStock.push(p);
    } else if (status === 'low') {
      lowStock.push(p);
    } else {
      availableFood.push(p);
    }
  }

  let title = '';
  let body = '';
  let shouldSend = false;
  let priority = null;

  if (expired.length > 0 || expiringSoon.length > 0) {
    shouldSend = true;
    priority = 1;
    if (expired.length > 0 && expiringSoon.length > 0) {
      title = '⚠️ Expiry Alert!';
      body = `${expired.length} item(s) expired, ${expiringSoon.length} expiring soon. Check your stock!`;
    } else if (expired.length > 0) {
      title = '🚨 Items Expired!';
      body = `${expired.length} items expired.`;
    } else {
      title = '⏰ Expiring Soon!';
      body = `${expiringSoon.length} items expiring within 3 days.`;
    }
  } else if (outOfStock.length > 0) {
    shouldSend = true;
    priority = 2;
    title = '🛒 Restock Reminder';
    body = `${outOfStock.length} items out of stock.`;
  } else if (lowStock.length > 0) {
    shouldSend = true;
    priority = 2.5;
    title = '⚠️ Running Low';
    body = `${lowStock.length} items running low.`;
  } else if (isEvening && availableFood.length > 3) {
    shouldSend = true;
    priority = 3;
    title = '🍳 All Stocked Up!';
    body = 'What shall we cook tonight?';
  } else if (isMorning && products.length > 0) {
    shouldSend = true;
    priority = 4;
    title = '📦 Good Morning!';
    body = `You have ${products.length} items tracked.`;
  }

  return { shouldSend, priority, title, body };
}

describe('smart-reminder notification priority logic', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const expiredDate = yesterday.toISOString().split('T')[0];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const soonDate = tomorrow.toISOString().split('T')[0];

  const farFuture = new Date();
  farFuture.setDate(farFuture.getDate() + 30);
  const futureDate = farFuture.toISOString().split('T')[0];

  it('Priority 1: expired items trigger expiry alert', () => {
    const products = [
      { product: 'Milk', expiry_date: expiredDate, availability: 'Yes', availability_status: 'available' },
    ];
    const result = determineNotification(products, { isMorning: true, isAfternoon: false, isEvening: false });
    expect(result.shouldSend).toBe(true);
    expect(result.priority).toBe(1);
    expect(result.title).toContain('Expired');
  });

  it('Priority 1: expiring soon items trigger expiry alert', () => {
    const products = [
      { product: 'Eggs', expiry_date: soonDate, availability: 'Yes', availability_status: 'available' },
    ];
    const result = determineNotification(products, { isMorning: true, isAfternoon: false, isEvening: false });
    expect(result.shouldSend).toBe(true);
    expect(result.priority).toBe(1);
    expect(result.title).toContain('Expiring');
  });

  it('Priority 1: both expired and expiring shows combined alert', () => {
    const products = [
      { product: 'Milk', expiry_date: expiredDate, availability: 'Yes', availability_status: 'available' },
      { product: 'Eggs', expiry_date: soonDate, availability: 'Yes', availability_status: 'available' },
    ];
    const result = determineNotification(products, { isMorning: true, isAfternoon: false, isEvening: false });
    expect(result.priority).toBe(1);
    expect(result.title).toContain('Expiry Alert');
  });

  it('Priority 2: out of stock items (no expiry issues)', () => {
    const products = [
      { product: 'Rice', expiry_date: futureDate, availability: 'No', availability_status: 'out_of_stock' },
      { product: 'Eggs', expiry_date: futureDate, availability: 'Yes', availability_status: 'available' },
    ];
    const result = determineNotification(products, { isMorning: true, isAfternoon: false, isEvening: false });
    expect(result.shouldSend).toBe(true);
    expect(result.priority).toBe(2);
    expect(result.title).toContain('Restock');
  });

  it('Priority 2: derives out_of_stock from legacy availability=No', () => {
    const products = [
      { product: 'Sugar', expiry_date: futureDate, availability: 'No' },
    ];
    const result = determineNotification(products, { isMorning: true, isAfternoon: false, isEvening: false });
    expect(result.priority).toBe(2);
  });

  it('Priority 2.5: low stock items', () => {
    const products = [
      { product: 'Oil', expiry_date: futureDate, availability: 'Yes', availability_status: 'low' },
    ];
    const result = determineNotification(products, { isMorning: true, isAfternoon: false, isEvening: false });
    expect(result.shouldSend).toBe(true);
    expect(result.priority).toBe(2.5);
    expect(result.title).toContain('Running Low');
  });

  it('Priority 3: evening "what to cook" when all stocked', () => {
    const products = [
      { product: 'Rice', expiry_date: futureDate, availability: 'Yes', availability_status: 'available' },
      { product: 'Dal', expiry_date: futureDate, availability: 'Yes', availability_status: 'available' },
      { product: 'Oil', expiry_date: futureDate, availability: 'Yes', availability_status: 'available' },
      { product: 'Salt', expiry_date: futureDate, availability: 'Yes', availability_status: 'available' },
    ];
    const result = determineNotification(products, { isMorning: false, isAfternoon: false, isEvening: true });
    expect(result.shouldSend).toBe(true);
    expect(result.priority).toBe(3);
    expect(result.title).toContain('Stocked Up');
  });

  it('Priority 4: morning status when all good', () => {
    const products = [
      { product: 'Rice', expiry_date: futureDate, availability: 'Yes', availability_status: 'available' },
    ];
    const result = determineNotification(products, { isMorning: true, isAfternoon: false, isEvening: false });
    expect(result.shouldSend).toBe(true);
    expect(result.priority).toBe(4);
    expect(result.title).toContain('Good Morning');
  });

  it('does not send in afternoon when all is good and few items', () => {
    const products = [
      { product: 'Rice', expiry_date: futureDate, availability: 'Yes', availability_status: 'available' },
    ];
    const result = determineNotification(products, { isMorning: false, isAfternoon: true, isEvening: false });
    expect(result.shouldSend).toBe(false);
  });

  it('does not send when no products', () => {
    const result = determineNotification([], { isMorning: true, isAfternoon: false, isEvening: false });
    expect(result.shouldSend).toBe(false);
  });

  it('expiry takes priority over out-of-stock', () => {
    const products = [
      { product: 'Milk', expiry_date: expiredDate, availability: 'Yes', availability_status: 'available' },
      { product: 'Rice', expiry_date: futureDate, availability: 'No', availability_status: 'out_of_stock' },
    ];
    const result = determineNotification(products, { isMorning: true, isAfternoon: false, isEvening: false });
    expect(result.priority).toBe(1); // Expiry wins over out-of-stock
  });
});
