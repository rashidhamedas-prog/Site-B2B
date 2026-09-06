import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettingEntity } from '../../settings/entities/app-setting.entity';
import { defaultSecretRefFor, OMNICHANNEL_PROVIDERS } from '../omnichannel.constants';
import {
  applyVaultOverlay,
  decryptToken,
  deriveVaultKey,
  encryptToken,
  envProviderRefs,
  OMNICHANNEL_VAULT_SETTING_KEY,
  parseStoredVault,
  publicSecretStatus,
  setVaultOverlayEntry,
  tokenFingerprint,
  vaultOverlayRefs,
  type SecretStatus,
  type StoredVault,
  type StoredVaultEntry,
  type VaultEntryPublic,
} from '../omnichannel-token-vault';

@Injectable()
export class OmnichannelTokenVaultService implements OnModuleInit {
  private readonly logger = new Logger(OmnichannelTokenVaultService.name);
  private lastHydratedAt = 0;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(
    @InjectRepository(AppSettingEntity)
    private readonly appSettings: Repository<AppSettingEntity>,
  ) {}

  async onModuleInit() {
    await this.hydrate();
  }

  async hydrate(): Promise<void> {
    let key: Buffer;
    try {
      key = deriveVaultKey();
    } catch {
      this.logger.warn('omnichannel vault key missing; overlay cleared until OMNICHANNEL_VAULT_KEY is set');
      applyVaultOverlay({});
      this.lastHydratedAt = 0;
      return;
    }
    const row = await this.appSettings.findOne({ where: { key: OMNICHANNEL_VAULT_SETTING_KEY } });
    const stored = parseStoredVault(row?.value);
    const plain: Record<string, string> = {};
    const meta: Record<string, VaultEntryPublic> = {};
    for (const [name, entry] of Object.entries(stored.entries)) {
      try {
        const token = decryptToken(entry, key, name);
        plain[name] = token;
        meta[name] = { fingerprint: entry.fingerprint || tokenFingerprint(token), updatedAt: entry.updatedAt };
      } catch {
        this.logger.warn(`omnichannel vault entry unreadable for ${name}`);
      }
    }
    applyVaultOverlay(plain, meta);
    this.lastHydratedAt = Date.now();
  }

  /** Worker re-reads at most every 15s so a token saved in the API process reaches this process. */
  async refreshIfStale(maxAgeMs = 15_000): Promise<void> {
    if (this.lastHydratedAt && Date.now() - this.lastHydratedAt < maxAgeMs) return;
    await this.hydrate();
  }

  async put(secretRef: string, token: string): Promise<SecretStatus> {
    const key = deriveVaultKey();
    const updatedAt = new Date().toISOString();
    const entry: StoredVaultEntry = {
      ...encryptToken(token, key, secretRef),
      fingerprint: tokenFingerprint(token),
      updatedAt,
    };
    await this.mutate((stored) => {
      stored.entries[secretRef] = entry;
    });
    setVaultOverlayEntry(secretRef, token, { fingerprint: entry.fingerprint, updatedAt });
    return publicSecretStatus(secretRef);
  }

  async clear(secretRef: string): Promise<SecretStatus> {
    await this.mutate((stored) => {
      delete stored.entries[secretRef];
    });
    setVaultOverlayEntry(secretRef, null);
    return publicSecretStatus(secretRef);
  }

  async statuses(extraRefs: string[] = []): Promise<SecretStatus[]> {
    const names = new Set<string>([
      ...OMNICHANNEL_PROVIDERS.map((provider) => defaultSecretRefFor(provider)),
      ...envProviderRefs(),
      ...vaultOverlayRefs(),
      ...extraRefs,
    ]);
    return [...names]
      .filter(Boolean)
      .sort()
      .map((secretRef) => publicSecretStatus(secretRef));
  }

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writeChain.then(fn, fn);
    this.writeChain = run.then(() => undefined, () => undefined);
    return run;
  }

  /** One row, one writer: in-process queue + SELECT FOR UPDATE. */
  private mutate(apply: (stored: StoredVault) => void): Promise<void> {
    return this.serialize(() =>
      this.appSettings.manager.transaction(async (em) => {
        const repo = em.getRepository(AppSettingEntity);
        const row = await repo
          .createQueryBuilder('s')
          .setLock('pessimistic_write')
          .where('s.key = :key', { key: OMNICHANNEL_VAULT_SETTING_KEY })
          .getOne();
        const stored = parseStoredVault(row?.value);
        apply(stored);
        if (row) {
          row.value = stored;
          await repo.save(row);
          return;
        }
        await repo.save(repo.create({ key: OMNICHANNEL_VAULT_SETTING_KEY, value: stored }));
      }),
    );
  }
}
