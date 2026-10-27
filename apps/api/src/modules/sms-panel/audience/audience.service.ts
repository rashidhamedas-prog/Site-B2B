import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { normalizeIranMobileStrict } from '../domain/phone';
import { mergeAudienceHits, presentAudienceContact, presentAudienceContacts, settleSources } from './audience-merge';
import { countSource, loadSourceHits, loadSuppressionPhones, type AudienceDb } from './audience-sources';
import {
  AUDIENCE_SOURCE_PRIORITY,
  isAudienceSource,
  type AudienceSource,
} from './audience.types';

@Injectable()
export class AudienceService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private db(): AudienceDb {
    return {
      query: (sql, params) => this.dataSource.query(sql, params),
    };
  }

  async sources() {
    const db = this.db();
    const settled = await Promise.all(
      AUDIENCE_SOURCE_PRIORITY.map(async (source) => {
        try {
          const count = await countSource(db, source);
          return { source, count, available: true as const };
        } catch {
          return { source, count: 0, available: false as const };
        }
      }),
    );
    return {
      sources: settled,
      partialSources: settled.filter((row) => !row.available).map((row) => row.source),
    };
  }

  async search(input: {
    q?: string;
    source?: string;
    page?: number;
    pageSize?: number;
    role?: string;
  }) {
    const source = this.parseSource(input.source);
    const pageSize = Math.min(50, Math.max(1, Number(input.pageSize) || 20));
    const page = Math.max(1, Number(input.page) || 1);
    const sources = source ? [source] : [...AUDIENCE_SOURCE_PRIORITY];
    const loaded = await this.loadSources(sources, { q: input.q?.trim() || null });
    const start = (page - 1) * pageSize;
    return {
      items: presentAudienceContacts(loaded.contacts.slice(start, start + pageSize), input.role),
      page,
      pageSize,
      total: loaded.contacts.length,
      invalid: loaded.invalid.length,
      partialSources: loaded.partialSources,
    };
  }

  async getByPhone(phoneRaw: string, role?: string) {
    const phone = normalizeIranMobileStrict(phoneRaw);
    if (!phone) {
      throw new BadRequestException({ message: 'شماره نامعتبر است', code: 'SMS_INVALID_PHONE' });
    }
    const loaded = await this.loadSources([...AUDIENCE_SOURCE_PRIORITY], { phone });
    const contact = loaded.contacts.find((row) => row.phone === phone);
    if (!contact) {
      throw new NotFoundException({ message: 'مخاطب پیدا نشد', code: 'SMS_CONTACT_NOT_FOUND' });
    }
    return {
      contact: presentAudienceContact(contact, role),
      partialSources: loaded.partialSources,
    };
  }

  private parseSource(raw?: string): AudienceSource | undefined {
    const value = String(raw || '').trim();
    if (!value) return undefined;
    if (!isAudienceSource(value)) {
      throw new BadRequestException({ message: 'منبع نامعتبر است', code: 'SMS_AUDIENCE_SOURCE' });
    }
    return value;
  }

  async distinctCities(): Promise<string[]> {
    const rows = await this.db().query<{ city: string }>(
      `SELECT DISTINCT c.city AS "city" FROM customers c
       WHERE c."deletedAt" IS NULL AND c.city IS NOT NULL AND c.city <> ''
       ORDER BY c.city
       LIMIT 500`,
    );
    return rows.map((row) => row.city).filter(Boolean);
  }

  collect(sources: AudienceSource[]) {
    return this.loadSources(sources, { wide: true, limit: 50_000 });
  }

  private async loadSources(
    sources: AudienceSource[],
    opts: { q?: string | null; phone?: string | null; wide?: boolean; limit?: number },
  ) {
    const db = this.db();
    const loaders = {
      WHOLESALE: async () => [],
      WHOLESALE_REFERRAL: async () => [],
      SALES_PARTNER: async () => [],
      RETAIL: async () => [],
    } as Record<AudienceSource, () => Promise<import('./audience.types').AudienceHit[]>>;
    const invalid: string[] = [];
    for (const source of sources) {
      loaders[source] = async () => {
        const loaded = await loadSourceHits(db, source, opts);
        invalid.push(...loaded.invalid);
        return loaded.hits;
      };
    }
    const settled = await settleSources(loaders);
    const phones = [
      ...new Set(
        settled.rows
          .map((hit) => normalizeIranMobileStrict(hit.phoneRaw))
          .filter((phone): phone is string => !!phone),
      ),
    ];
    const flags = await loadSuppressionPhones(db, phones).catch(() => null);
    const merged = mergeAudienceHits({
      hits: settled.rows,
      optedOutPhones: flags?.optedOut || [],
      blacklistedPhones: flags?.blacklisted || [],
    });
    const partialSources = [...settled.partialSources];
    if (!flags && phones.length && !partialSources.includes('WHOLESALE')) {
      partialSources.push('WHOLESALE');
    }
    const validHits = settled.rows.filter((hit) => normalizeIranMobileStrict(hit.phoneRaw)).length;
    const duplicateExtras = Math.max(0, validHits - phones.length);
    return {
      contacts: merged.contacts,
      invalid: [...invalid, ...merged.invalid],
      duplicateExtras,
      partialSources,
    };
  }
}
