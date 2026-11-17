import type { OfferStatus } from '@prisma/client';

export const OFFER_STATUS_CHANGED_EVENT = 'offer.status-changed';

export class OfferStatusChangedEvent {
  constructor(
    public readonly offerId: string,
    public readonly dealId: string,
    public readonly status: OfferStatus,
  ) {}
}