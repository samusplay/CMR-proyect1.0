import { jest } from '@jest/globals';

export const mockPrismaService = {
  campaign: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

export const mockCampaigns = [
  { id: '1', name: 'Promo Verano', channel: 'facebook', utmSource: 'ads', active: true },
  { id: '2', name: 'Promo Invierno', channel: 'google', utmSource: 'search', active: true }
];