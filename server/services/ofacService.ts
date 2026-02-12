import { XMLParser } from 'fast-xml-parser';
import { db } from '../db';
import { ofacSanctionedAddresses, ofacUpdateLog } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

const SDN_ADVANCED_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.XML';
const SDN_ZIP_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.ZIP';

const DIGITAL_CURRENCY_TYPES: Record<string, string> = {
  'XBT': 'bitcoin',
  'ETH': 'ethereum',
  'XRP': 'ripple',
  'LTC': 'litecoin',
  'BCH': 'bitcoin-cash',
  'DASH': 'dash',
  'XMR': 'monero',
  'XVG': 'verge',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'TRX': 'tron',
  'ARB': 'arbitrum',
  'BSC': 'bsc',
  'ERC20': 'ethereum',
  'TRC20': 'tron',
};

interface ExtractedAddress {
  address: string;
  addressType: string;
  sdnName: string;
  sdnId: string;
}

interface OfacCheckResult {
  isSanctioned: boolean;
  address: string;
  matchedEntries: {
    sdnName: string | null;
    sdnId: string | null;
    addressType: string;
    source: string;
  }[];
  checkedAt: string;
}

interface OfacStatusResult {
  lastUpdate: string | null;
  totalAddresses: number;
  lastUpdateSuccess: boolean;
  addressTypes: Record<string, number>;
}

class OfacService {
  private isUpdating = false;

  async checkAddress(address: string): Promise<OfacCheckResult> {
    const normalizedAddress = address.toLowerCase().trim();

    const matches = await db.select()
      .from(ofacSanctionedAddresses)
      .where(eq(ofacSanctionedAddresses.addressLower, normalizedAddress));

    return {
      isSanctioned: matches.length > 0,
      address,
      matchedEntries: matches.map(m => ({
        sdnName: m.sdnName,
        sdnId: m.sdnId,
        addressType: m.addressType,
        source: m.source,
      })),
      checkedAt: new Date().toISOString(),
    };
  }

  async getStatus(): Promise<OfacStatusResult> {
    const [lastLog] = await db.select()
      .from(ofacUpdateLog)
      .orderBy(sql`${ofacUpdateLog.createdAt} DESC`)
      .limit(1);

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(ofacSanctionedAddresses);
    const totalAddresses = Number(countResult[0]?.count || 0);

    const typeCountsResult = await db.select({
      addressType: ofacSanctionedAddresses.addressType,
      count: sql<number>`count(*)`,
    })
      .from(ofacSanctionedAddresses)
      .groupBy(ofacSanctionedAddresses.addressType);

    const addressTypes: Record<string, number> = {};
    for (const row of typeCountsResult) {
      addressTypes[row.addressType] = Number(row.count);
    }

    return {
      lastUpdate: lastLog?.createdAt?.toISOString() || null,
      totalAddresses,
      lastUpdateSuccess: lastLog?.success ?? true,
      addressTypes,
    };
  }

  async updateList(): Promise<{ success: boolean; totalAddresses: number; newAddresses: number; removedAddresses: number; error?: string }> {
    if (this.isUpdating) {
      return { success: false, totalAddresses: 0, newAddresses: 0, removedAddresses: 0, error: 'Update already in progress' };
    }

    this.isUpdating = true;
    console.log('[OFAC] Starting SDN list update...');

    try {
      const addresses = await this.fetchAndParseSDNList();
      console.log(`[OFAC] Extracted ${addresses.length} digital currency addresses from SDN list`);

      const existingResult = await db.select({ count: sql<number>`count(*)` })
        .from(ofacSanctionedAddresses);
      const existingCount = Number(existingResult[0]?.count || 0);

      await db.delete(ofacSanctionedAddresses);

      let insertedCount = 0;
      const batchSize = 100;
      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize).map(a => ({
          address: a.address,
          addressLower: a.address.toLowerCase(),
          addressType: a.addressType,
          sdnName: a.sdnName,
          sdnId: a.sdnId,
          source: 'OFAC_SDN',
          lastSeenAt: new Date(),
        }));
        await db.insert(ofacSanctionedAddresses).values(batch);
        insertedCount += batch.length;
      }

      const newAddresses = Math.max(0, insertedCount - existingCount);
      const removedAddresses = Math.max(0, existingCount - insertedCount);

      await db.insert(ofacUpdateLog).values({
        totalAddresses: insertedCount,
        newAddresses,
        removedAddresses,
        sourceUrl: SDN_ADVANCED_URL,
        success: true,
      });

      console.log(`[OFAC] Update complete: ${insertedCount} addresses stored (${newAddresses} new, ${removedAddresses} removed)`);

      return {
        success: true,
        totalAddresses: insertedCount,
        newAddresses,
        removedAddresses,
      };
    } catch (error: any) {
      console.error('[OFAC] Update failed:', error.message);

      await db.insert(ofacUpdateLog).values({
        totalAddresses: 0,
        newAddresses: 0,
        removedAddresses: 0,
        sourceUrl: SDN_ADVANCED_URL,
        success: false,
        errorMessage: error.message,
      });

      return {
        success: false,
        totalAddresses: 0,
        newAddresses: 0,
        removedAddresses: 0,
        error: error.message,
      };
    } finally {
      this.isUpdating = false;
    }
  }

  private async fetchAndParseSDNList(): Promise<ExtractedAddress[]> {
    console.log('[OFAC] Fetching SDN_ADVANCED.XML...');

    const response = await fetch(SDN_ADVANCED_URL, {
      headers: {
        'Accept': 'application/xml',
        'User-Agent': 'CryptoPaymentLibrary/2.0 OFAC-Compliance-Check',
      },
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch SDN list: HTTP ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();
    console.log(`[OFAC] Downloaded ${(xmlText.length / 1024 / 1024).toFixed(1)}MB XML data`);

    return this.parseXML(xmlText);
  }

  private parseXML(xmlText: string): ExtractedAddress[] {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name) => {
        return ['sdnEntry', 'id', 'aka', 'address', 'nationality',
          'dateOfBirth', 'placeOfBirth', 'feature', 'idList'].includes(name);
      },
    });

    const parsed = parser.parse(xmlText);
    const addresses: ExtractedAddress[] = [];

    const entries = this.findEntries(parsed);
    if (!entries || entries.length === 0) {
      console.log('[OFAC] No SDN entries found in XML, trying alternative parsing...');
      return this.parseAlternativeFormat(xmlText);
    }

    for (const entry of entries) {
      const sdnName = this.extractName(entry);
      const sdnId = entry['@_uid'] || entry.uid || '';

      const ids = this.normalizeArray(entry.idList || entry.id || []);
      for (const id of ids) {
        const idItems = this.normalizeArray(id.id || [id]);
        for (const idItem of idItems) {
          const idType = (idItem.idType || idItem['@_IDType'] || '').toString();
          const idNumber = (idItem.idNumber || idItem['@_IDNumber'] || idItem['#text'] || '').toString().trim();

          if (idType.includes('Digital Currency Address') && idNumber) {
            const ticker = this.extractTicker(idType);
            addresses.push({
              address: idNumber,
              addressType: ticker,
              sdnName: sdnName.substring(0, 500),
              sdnId: sdnId.toString(),
            });
          }
        }
      }

      const features = this.normalizeArray(entry.features?.feature || entry.feature || []);
      for (const feature of features) {
        const featureType = (feature.featureType || feature['@_FeatureType'] || '').toString();
        const featureValue = (feature.featureValue || feature.versionDetail?.detailReference?.['#text'] || '').toString().trim();

        if (featureType.includes('Digital Currency Address') && featureValue) {
          const ticker = this.extractTicker(featureType);
          addresses.push({
            address: featureValue,
            addressType: ticker,
            sdnName: sdnName.substring(0, 500),
            sdnId: sdnId.toString(),
          });
        }
      }
    }

    if (addresses.length === 0) {
      return this.parseAlternativeFormat(xmlText);
    }

    return addresses;
  }

  private parseAlternativeFormat(xmlText: string): ExtractedAddress[] {
    const addresses: ExtractedAddress[] = [];

    const digitalCurrencyRegex = /Digital Currency Address\s*[-–]\s*(\w+)/gi;
    const addressValueRegex = /<(?:idNumber|VersionDetail|DetailReference)[^>]*>([13][a-km-zA-HJ-NP-Z1-9]{25,34}|0x[a-fA-F0-9]{40}|T[a-zA-Z0-9]{33}|bc1[a-zA-HJ-NP-Z0-9]{25,90}|[a-fA-F0-9]{40,130})<\//gi;

    const lines = xmlText.split('\n');
    let currentSdnName = '';
    let currentSdnId = '';
    let currentIdType = '';

    for (const line of lines) {
      const nameMatch = line.match(/<(?:lastName|wholeName)>([^<]+)<\//i);
      if (nameMatch) {
        currentSdnName = nameMatch[1].trim();
      }

      const uidMatch = line.match(/uid[="](\d+)/i);
      if (uidMatch) {
        currentSdnId = uidMatch[1];
      }

      const typeMatch = line.match(/Digital Currency Address\s*[-–]\s*(\w+)/i);
      if (typeMatch) {
        currentIdType = this.normalizeTicker(typeMatch[1]);
      }

      const addressPatterns = [
        />(0x[a-fA-F0-9]{40})</,
        />(T[a-zA-Z0-9]{33})</,
        />([13][a-km-zA-HJ-NP-Z1-9]{25,34})</,
        />(bc1[a-zA-HJ-NP-Z0-9]{25,90})</,
      ];

      for (const pattern of addressPatterns) {
        const match = line.match(pattern);
        if (match && currentIdType) {
          addresses.push({
            address: match[1],
            addressType: currentIdType,
            sdnName: currentSdnName.substring(0, 500),
            sdnId: currentSdnId,
          });
        }
      }
    }

    return addresses;
  }

  private findEntries(parsed: any): any[] {
    if (parsed.sdnList?.sdnEntry) return this.normalizeArray(parsed.sdnList.sdnEntry);
    if (parsed.Sanctions?.SanctionsEntries?.SanctionsEntry) return this.normalizeArray(parsed.Sanctions.SanctionsEntries.SanctionsEntry);

    const findInObj = (obj: any, depth = 0): any[] => {
      if (depth > 5 || !obj || typeof obj !== 'object') return [];
      for (const key of Object.keys(obj)) {
        if (key.toLowerCase().includes('entry') || key.toLowerCase().includes('sdn')) {
          const val = obj[key];
          if (Array.isArray(val) && val.length > 0) return val;
        }
        const result = findInObj(obj[key], depth + 1);
        if (result.length > 0) return result;
      }
      return [];
    };

    return findInObj(parsed);
  }

  private extractName(entry: any): string {
    if (entry.lastName) return entry.lastName;
    if (entry.wholeName) return entry.wholeName;
    if (entry.firstName && entry.lastName) return `${entry.firstName} ${entry.lastName}`;
    if (entry.name) return typeof entry.name === 'string' ? entry.name : JSON.stringify(entry.name);
    return 'Unknown';
  }

  private extractTicker(idType: string): string {
    const match = idType.match(/Digital Currency Address\s*[-–]\s*(\w+)/i);
    if (match) {
      return this.normalizeTicker(match[1]);
    }
    return 'unknown';
  }

  private normalizeTicker(ticker: string): string {
    const upper = ticker.toUpperCase();
    return DIGITAL_CURRENCY_TYPES[upper] || upper.toLowerCase();
  }

  private normalizeArray(val: any): any[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return [val];
  }
}

export const ofacService = new OfacService();
