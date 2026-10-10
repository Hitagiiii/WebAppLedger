// ============================================
// Schema migrations. `loadDatabase` and `parseBackup` run every parsed
// payload through `migrateDatabase` BEFORE structural sanitization, so both
// live localStorage data and imported v1 backups upgrade in place.
//
// v1 → v2 (multi-account):
//  - One "Cash" account is created carrying settings.openingBalance.
//  - Every existing transaction is assigned to that account.
//  - settings.openingBalance is zeroed (money now lives on the account).
//  - Everything else — dates, amounts, categories, budgets, goals, debts,
//    profile, settings — is preserved untouched.
//
// The migration is idempotent: a v2 payload (or a payload migrated once) is
// returned unchanged, and re-running it never duplicates accounts or
// reassigns transactions.
// ============================================

import type { Account, Transaction } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const MIGRATED_AT = '2026-01-01T00:00:00.000Z';

/** The account v1 opening balances are moved into. */
export const MIGRATED_ACCOUNT_ID = 'acct-main';

export function migrateDatabase(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;

  const version = raw.version;
  const hasAccounts = Array.isArray(raw.accounts) && raw.accounts.length > 0;

  // Already current — idempotent passthrough.
  if (version === 2 && hasAccounts) return raw;
  // Unknown versions are left for sanitizeDatabase to reject.
  if (version !== 1 && version !== 2) return raw;

  const settings = isRecord(raw.settings) ? { ...raw.settings } : {};
  const opening =
    typeof settings.openingBalance === 'number' && Number.isInteger(settings.openingBalance)
      ? settings.openingBalance
      : 0;

  // Reuse existing accounts when present (repair path); otherwise create the
  // single migrated account holding the old aggregate opening balance.
  let accounts: Account[] = Array.isArray(raw.accounts)
    ? (raw.accounts.filter(
        (a): a is Account =>
          isRecord(a) && typeof a.id === 'string' && typeof a.name === 'string',
      ) as Account[])
    : [];
  const movedOpeningBalance = accounts.length === 0;
  if (movedOpeningBalance) {
    accounts = [
      {
        id: MIGRATED_ACCOUNT_ID,
        name: 'Cash',
        group: 'held',
        openingBalance: opening,
        archived: false,
        createdAt: MIGRATED_AT,
        updatedAt: MIGRATED_AT,
      },
    ];
  }

  const accountIds = new Set(accounts.map((a) => a.id));
  const fallbackId = accounts[0].id;

  // Assign every transaction to a valid account; missing/dangling refs land
  // on the fallback account so no historical record is lost.
  const transactions: Transaction[] = Array.isArray(raw.transactions)
    ? raw.transactions
        .filter((t): t is Transaction => isRecord(t))
        .map((t) =>
          typeof t.account === 'string' && accountIds.has(t.account)
            ? t
            : { ...t, account: fallbackId },
        )
    : [];

  return {
    ...raw,
    version: 2,
    // Zeroed only when the opening balance was moved onto the created
    // account, so the same money is never counted twice.
    settings: { ...settings, openingBalance: movedOpeningBalance ? 0 : opening },
    accounts,
    transactions,
  };
}
