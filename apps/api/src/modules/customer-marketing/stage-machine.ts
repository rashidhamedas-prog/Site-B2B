import {
  SETTLED_ORDER_STATUSES,
  type MarketingChannel,
} from './customer-marketing.constants';

export function isSettledOrderStatus(status: string): boolean {
  return (SETTLED_ORDER_STATUSES as readonly string[]).includes(status);
}

export function resolveStage(input: {
  channel: MarketingChannel;
  customerStatus: string;
  settledOrderCount: number;
  daysSinceLastSettledOrder: number | null;
  dormantAfterDays: number;
  current?: string | null;
}): string {
  if (input.channel === 'RETAIL') {
    if (input.current === 'DORMANT' && input.settledOrderCount > 0 && (input.daysSinceLastSettledOrder ?? 99) < input.dormantAfterDays) {
      return input.settledOrderCount >= 2 ? 'REPEAT' : 'ACTIVE_BUYER';
    }
    if (input.settledOrderCount === 0) {
      if ((input.daysSinceLastSettledOrder ?? 0) >= input.dormantAfterDays && input.current === 'REGISTERED') {
        return 'DORMANT';
      }
      return 'REGISTERED';
    }
    if (input.daysSinceLastSettledOrder != null && input.daysSinceLastSettledOrder >= input.dormantAfterDays) {
      return 'DORMANT';
    }
    return input.settledOrderCount >= 2 ? 'REPEAT' : 'ACTIVE_BUYER';
  }

  if (input.current === 'NEEDS_DOCS') return 'NEEDS_DOCS';
  if (input.customerStatus !== 'ACTIVE' && input.settledOrderCount === 0) return 'APPLIED';
  if (input.settledOrderCount === 0) {
    if (input.daysSinceLastSettledOrder != null && input.daysSinceLastSettledOrder >= input.dormantAfterDays) {
      return 'DORMANT';
    }
    return 'APPROVED';
  }
  if (input.daysSinceLastSettledOrder != null && input.daysSinceLastSettledOrder >= input.dormantAfterDays) {
    return 'DORMANT';
  }
  return input.settledOrderCount >= 2 ? 'ACTIVE' : 'FIRST_ORDER';
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}
