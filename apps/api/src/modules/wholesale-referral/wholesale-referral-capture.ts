export const WHOLESALE_REFERRAL_CAPTURE = 'WHOLESALE_REFERRAL_CAPTURE';

export type WholesaleReferralCaptureInput = {
  customerId: string;
  phone: string;
  referralCode?: string | null;
};

export interface WholesaleReferralCapture {
  onWholesaleRegistered(input: WholesaleReferralCaptureInput): Promise<void>;
}
