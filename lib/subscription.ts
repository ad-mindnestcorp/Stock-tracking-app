/**
 * RevenueCat wrapper for Vesto in-app subscriptions.
 *
 * Setup checklist:
 * 1. Add EXPO_PUBLIC_REVENUECAT_IOS_KEY and EXPO_PUBLIC_REVENUECAT_ANDROID_KEY to .env
 * 2. Configure products in App Store Connect / Google Play Console
 * 3. Create an Offering in the RevenueCat dashboard with identifier "default"
 * 4. Add packages with identifiers "$rc_monthly" and "$rc_annual"
 * 5. Create an entitlement with identifier "premium" and attach both products
 */

import Purchases, {
  type PurchasesPackage,
  type PurchasesOffering,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
const ENTITLEMENT_ID = 'premium';

export interface VestoPackage {
  identifier: string;
  productIdentifier: string;
  title: string;
  price: string;
  prialPeriod: string | null;
  packageType: string;
  rcPackage: PurchasesPackage;
}

export interface VestoOfferings {
  monthly: VestoPackage | null;
  annual: VestoPackage | null;
  current: PurchasesOffering | null;
}

let initialized = false;

export async function initPurchases(userId: string | null): Promise<void> {
  try {
    const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
    if (!apiKey) return;

    if (!initialized) {
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }
      await Purchases.configure({ apiKey });
      initialized = true;
    }

    if (userId) {
      await Purchases.logIn(userId);
    }
  } catch {
    // RevenueCat not configured — silent fail in dev
  }
}

function mapPackage(pkg: PurchasesPackage): VestoPackage {
  // A free trial exists when introPrice has a price of 0
  const hasFreeTrial =
    pkg.product.introPrice != null && pkg.product.introPrice.price === 0;
  return {
    identifier: pkg.identifier,
    productIdentifier: pkg.product.identifier,
    title: pkg.product.title,
    price: pkg.product.priceString,
    prialPeriod: hasFreeTrial ? 'free_trial' : null,
    packageType: pkg.packageType,
    rcPackage: pkg,
  };
}

export async function getOfferings(): Promise<VestoOfferings> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return { monthly: null, annual: null, current: null };

    const monthly = current.monthly ? mapPackage(current.monthly) : null;
    const annual = current.annual ? mapPackage(current.annual) : null;
    return { monthly, annual, current };
  } catch {
    return { monthly: null, annual: null, current: null };
  }
}

export async function purchasePackage(packageId: string): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return false;

    const allPackages = current.availablePackages;
    const pkg = allPackages.find((p) => p.identifier === packageId);
    if (!pkg) return false;

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (err: unknown) {
    // User cancelled — not an error
    if (err && typeof err === 'object' && 'userCancelled' in err) return false;
    throw err;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}

export async function isEntitlementActive(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}
