import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { SalesPartnerCatalogService } from './sales-partner-catalog.service';
import {
  mergedClickedProducts,
  referralClickBurstAllowed,
  REFERRAL_SESSION_TTL_MS,
  referralSessionSecret,
  signReferralSession,
  verifyReferralSession,
  type ReferralSessionClaims,
} from './sales-partner-referral-policy';

type SessionRow = {
  id: string;
  salesPartnerId: string;
  publicCode: string;
  productIds: string[];
  expiresAt: Date;
  supersededAt: Date | null;
};

@Injectable()
export class SalesPartnerReferralService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly catalog: SalesPartnerCatalogService,
    private readonly config: ConfigService,
  ) {}

  private secret(): string {
    const secret = referralSessionSecret(this.config.get<string>('JWT_SECRET') || process.env.JWT_SECRET);
    if (!secret) throw new BadRequestException('نشست ارجاع در این محیط قابل صدور نیست');
    return secret;
  }

  async issueClick(code: string, slug: string, previousToken?: string) {
    const link = await this.catalog.resolveShareLink(code, slug);
    const secret = this.secret();
    const now = Date.now();
    const previous = previousToken ? verifyReferralSession(previousToken, secret, now) : null;
    const previousRow = previous ? await this.openSession(previous.sid) : null;
    const livePrevious = previousRow && previous && previousRow.salesPartnerId === previous.partnerId
      ? previous
      : null;
    const productIds = mergedClickedProducts(
      livePrevious?.partnerId ?? null,
      livePrevious?.productIds ?? [],
      link.salesPartnerId,
      link.productId,
    );
    const sid = randomUUID();
    const exp = now + REFERRAL_SESSION_TTL_MS;
    const previousId = livePrevious?.sid ?? null;
    await this.dataSource.transaction(async (manager) => {
      if (previousId) {
        await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`sp-click-prev:${previousId}`]);
      }
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`sp-click:${link.publicCode}`]);
      const recent = (await manager.query(
        `SELECT COUNT(*)::int AS n
         FROM sales_partner_referral_sessions
         WHERE "publicCode" = $1 AND "createdAt" > NOW() - interval '1 minute'`,
        [link.publicCode],
      )) as Array<{ n: number }>;
      if (!referralClickBurstAllowed(Number(recent[0]?.n || 0))) {
        throw new HttpException('تعداد کلیک این لینک موقتاً زیاد است', HttpStatus.TOO_MANY_REQUESTS);
      }
      if (previousId) {
        await manager.query(
          `UPDATE sales_partner_referral_sessions SET "supersededAt" = NOW() WHERE id = $1 AND "supersededAt" IS NULL`,
          [previousId],
        );
        await manager.query(
          `UPDATE sales_partner_referral_sessions
           SET "supersededAt" = NOW()
           WHERE "previousSessionId" = $1 AND "supersededAt" IS NULL`,
          [previousId],
        );
      }
      await manager.query(
        `INSERT INTO sales_partner_referral_sessions
          (id, "salesPartnerId", "publicCode", "productIds", "expiresAt", "previousSessionId")
         VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
        [sid, link.salesPartnerId, link.publicCode, JSON.stringify(productIds), new Date(exp), previousId],
      );
    });
    const claims: ReferralSessionClaims = {
      v: 1,
      sid,
      partnerId: link.salesPartnerId,
      publicCode: link.publicCode,
      productIds,
      exp,
    };
    return {
      token: signReferralSession(claims, secret),
      expiresAt: new Date(exp).toISOString(),
      productId: link.productId,
      slug: link.slug,
    };
  }

  async openSession(sid: string): Promise<SessionRow | null> {
    const rows = (await this.dataSource.query(
      `SELECT id, "salesPartnerId", "publicCode", "productIds", "expiresAt", "supersededAt"
       FROM sales_partner_referral_sessions WHERE id = $1 LIMIT 1`,
      [sid],
    )) as SessionRow[];
    const row = rows[0];
    if (!row || row.supersededAt) return null;
    if (new Date(row.expiresAt).getTime() <= Date.now()) return null;
    return row;
  }

  async statusForToken(token?: string) {
    const secret = referralSessionSecret(this.config.get<string>('JWT_SECRET') || process.env.JWT_SECRET);
    if (!secret || !token) return { exclusive: false as const };
    const claims = verifyReferralSession(token, secret, Date.now());
    if (!claims) return { exclusive: false as const };
    const row = await this.openSession(claims.sid);
    if (!row || row.salesPartnerId !== claims.partnerId) return { exclusive: false as const };
    return { exclusive: true as const, expiresAt: row.expiresAt };
  }

  async customerLock(customerId: string) {
    const rows = (await this.dataSource.query(
      `SELECT b."sessionId", b."expiresAt", s."supersededAt"
       FROM sales_partner_referral_bindings b
       JOIN sales_partner_referral_sessions s ON s.id = b."sessionId"
       WHERE b."customerId" = $1 AND b."expiresAt" > NOW()
       LIMIT 1`,
      [customerId],
    )) as Array<{ sessionId: string; expiresAt: Date; supersededAt: Date | null }>;
    const row = rows[0];
    if (!row || row.supersededAt) return { exclusive: false as const };
    return { exclusive: true as const, expiresAt: row.expiresAt };
  }

  async resolveCheckout(token: string | undefined, customerId: string) {
    const secret = referralSessionSecret(this.config.get<string>('JWT_SECRET') || process.env.JWT_SECRET);
    if (secret && token) {
      const claims = verifyReferralSession(token, secret, Date.now());
      if (claims) {
        const row = await this.openSession(claims.sid);
        if (row && row.salesPartnerId === claims.partnerId) {
          return {
            sessionId: row.id,
            partnerId: row.salesPartnerId,
            publicCode: row.publicCode,
            productIds: Array.isArray(row.productIds) ? row.productIds : claims.productIds,
          };
        }
      }
    }
    const rows = (await this.dataSource.query(
      `SELECT b."sessionId", b."salesPartnerId", b."publicCode", b."productIds"
       FROM sales_partner_referral_bindings b
       JOIN sales_partner_referral_sessions s ON s.id = b."sessionId"
       WHERE b."customerId" = $1 AND b."expiresAt" > NOW() AND s."supersededAt" IS NULL
       LIMIT 1`,
      [customerId],
    )) as Array<{ sessionId: string; salesPartnerId: string; publicCode: string; productIds: string[] }>;
    const bound = rows[0];
    if (!bound) return null;
    return {
      sessionId: bound.sessionId,
      partnerId: bound.salesPartnerId,
      publicCode: bound.publicCode,
      productIds: bound.productIds || [],
    };
  }

  async bindCustomer(customerId: string, session: {
    sessionId: string;
    partnerId: string;
    publicCode: string;
    productIds: string[];
    expiresAt: Date;
  }) {
    await this.dataSource.query(
      `INSERT INTO sales_partner_referral_bindings
        ("customerId", "sessionId", "salesPartnerId", "publicCode", "productIds", "expiresAt")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT ("customerId") DO UPDATE SET
         "sessionId" = EXCLUDED."sessionId",
         "salesPartnerId" = EXCLUDED."salesPartnerId",
         "publicCode" = EXCLUDED."publicCode",
         "productIds" = EXCLUDED."productIds",
         "expiresAt" = EXCLUDED."expiresAt"`,
      [
        customerId,
        session.sessionId,
        session.partnerId,
        session.publicCode,
        JSON.stringify(session.productIds),
        session.expiresAt,
      ],
    );
  }

  async purgeExpiredSessions(): Promise<number> {
    const removed = (await this.dataSource.query(
      `WITH gone AS (
         DELETE FROM sales_partner_referral_sessions s
         WHERE (
           s."expiresAt" < NOW() - interval '1 day'
           OR (s."supersededAt" IS NOT NULL AND s."supersededAt" < NOW() - interval '1 day')
         )
         AND NOT EXISTS (
           SELECT 1 FROM sales_partner_referral_bindings b
           WHERE b."sessionId" = s.id AND b."expiresAt" > NOW()
         )
         AND NOT EXISTS (
           SELECT 1 FROM orders o WHERE o."referralSessionId" = s.id
         )
         RETURNING 1
       )
       SELECT COUNT(*)::int AS n FROM gone`,
    )) as Array<{ n: number }>;
    await this.dataSource.query(
      `DELETE FROM sales_partner_referral_bindings WHERE "expiresAt" < NOW() - interval '1 day'`,
    );
    return Number(removed[0]?.n || 0);
  }
}
