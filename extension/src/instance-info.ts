import type { InstanceInfo } from '../../src/extension/protocol';

interface UaBrand {
  brand: string;
  version: string;
}

interface UaData {
  brands: UaBrand[];
  getHighEntropyValues(hints: string[]): Promise<{ fullVersionList?: UaBrand[] }>;
}

const FALLBACK_BRAND = 'Chromium';
const PLACEHOLDER_BRAND = /not.?a.?brand/i;

const uaData = (): UaData | undefined =>
  (navigator as Navigator & { userAgentData?: UaData }).userAgentData;

const pickBrand = (brands: UaBrand[]): UaBrand => {
  const real = brands.filter((b) => !PLACEHOLDER_BRAND.test(b.brand));
  return real.find((b) => b.brand !== FALLBACK_BRAND) ?? real[0] ?? { brand: FALLBACK_BRAND, version: '' };
};

const detectBrand = async (): Promise<UaBrand> => {
  const data = uaData();
  if (!data) return { brand: FALLBACK_BRAND, version: '' };
  const detailed = await data.getHighEntropyValues(['fullVersionList']).catch((): { fullVersionList?: UaBrand[] } => ({}));
  return pickBrand(detailed.fullVersionList ?? data.brands);
};

const workerStartedAt = Date.now();

export const describeInstance = async (id: string, label: string): Promise<InstanceInfo> => {
  const { brand, version } = await detectBrand();
  return { id, label, brand, version, userAgent: navigator.userAgent, workerStartedAt };
};
