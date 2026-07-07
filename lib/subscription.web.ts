import type { VestoOfferings } from './subscription';

export type { VestoPackage, VestoOfferings } from './subscription';

export async function initPurchases(_userId: string | null): Promise<void> {}

export async function getOfferings(): Promise<VestoOfferings> {
  return { monthly: null, annual: null, current: null };
}

export async function purchasePackage(_packageId: string): Promise<boolean> {
  return false;
}

export async function restorePurchases(): Promise<boolean> {
  return false;
}

export async function isEntitlementActive(): Promise<boolean> {
  return false;
}
