/** Campaign status transition guards (pure). */

export function canConfirmCampaign(status: string): boolean {
  return status === 'PREPARED';
}

export function canPauseCampaign(status: string): boolean {
  return status === 'SENDING' || status === 'SCHEDULED';
}

export function canResumeCampaign(status: string): boolean {
  return status === 'PAUSED';
}

export function canCancelCampaign(status: string): boolean {
  return status !== 'COMPLETED' && status !== 'CANCELLED';
}
