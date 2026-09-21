import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from '../campaigns/campaigns.service';
import { LeadsService } from '../leads/leads.service';
import { FacebookGraphService } from './facebook-graph.service';
import { FacebookService } from './facebook.service';

describe('FacebookService', () => {
  let service: FacebookService;
  let graph: any;
  let leadsService: any;
  let campaignsService: any;

  beforeEach(async () => {
    graph = { get: jest.fn() };
    leadsService = { create: jest.fn() };
    campaignsService = { findByNameAndChannel: jest.fn(), create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookService,
        { provide: FacebookGraphService, useValue: graph },
        { provide: LeadsService, useValue: leadsService },
        { provide: CampaignsService, useValue: campaignsService },
      ],
    }).compile();

    service = module.get<FacebookService>(FacebookService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('handleWebhookEvent', () => {
    it('dispara el procesamiento cuando el campo es leadgen', () => {
      const processLeadSpy = jest
        .spyOn(service as any, 'processLead')
        .mockResolvedValue(undefined);

      const body = {
        entry: [{ changes: [{ field: 'leadgen', value: { leadgen_id: 'lead-123' } }] }],
      };

      service.handleWebhookEvent(body);

      expect(processLeadSpy).toHaveBeenCalledWith('lead-123');
    });

    it('ignora eventos de campos que no son leadgen', () => {
      const processLeadSpy = jest
        .spyOn(service as any, 'processLead')
        .mockResolvedValue(undefined);

      const body = {
        entry: [{ changes: [{ field: 'messages', value: { some: 'data' } }] }],
      };

      service.handleWebhookEvent(body);

      expect(processLeadSpy).not.toHaveBeenCalled();
    });

    it('no lanza error si el body llega vacío o sin entry', () => {
      expect(() => service.handleWebhookEvent({})).not.toThrow();
      expect(() => service.handleWebhookEvent(null)).not.toThrow();
    });

    it('registra el error en el logger si processLead falla, sin tumbar la app', async () => {
      const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');
      jest.spyOn(service as any, 'processLead').mockRejectedValue(new Error('falló la Graph API'));

      const body = {
        entry: [{ changes: [{ field: 'leadgen', value: { leadgen_id: 'lead-999' } }] }],
      };

      service.handleWebhookEvent(body);

      // le damos un tick al event loop para que la promesa rechazada se resuelva
      await new Promise((resolve) => process.nextTick(resolve));

      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });

  describe('processLead (probado directo, es privado)', () => {
    it('crea el lead usando una campaña ya existente', async () => {
      graph.get.mockResolvedValue({
        field_data: [
          { name: 'full_name', values: ['Samuel Pérez'] },
          { name: 'email', values: ['samuel@test.com'] },
          { name: 'phone_number', values: ['3001234567'] },
        ],
        campaign_name: 'Promo Cargadores EV',
      });
      campaignsService.findByNameAndChannel.mockResolvedValue({ id: 'camp-1', name: 'Promo Cargadores EV' });

      await (service as any).processLead('lead-123');

      expect(campaignsService.create).not.toHaveBeenCalled();
      expect(leadsService.create).toHaveBeenCalledWith({
        name: 'Samuel Pérez',
        email: 'samuel@test.com',
        phone: '3001234567',
        campaignId: 'camp-1',
      });
    });

    it('crea la campaña automáticamente si no existe todavía', async () => {
      graph.get.mockResolvedValue({
        field_data: [
          { name: 'full_name', values: ['Samuel Pérez'] },
          { name: 'email', values: ['samuel@test.com'] },
        ],
        campaign_name: 'Campaña Nueva',
      });
      campaignsService.findByNameAndChannel.mockResolvedValue(null);
      campaignsService.create.mockResolvedValue({ id: 'camp-nueva' });

      await (service as any).processLead('lead-456');

      expect(campaignsService.create).toHaveBeenCalledWith({
        name: 'Campaña Nueva',
        channel: 'facebook',
      });
      expect(leadsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId: 'camp-nueva' }),
      );
    });

    it('usa "Facebook Lead Ads" como nombre de campaña si no viene ni campaign_name ni ad_name', async () => {
      graph.get.mockResolvedValue({
        field_data: [{ name: 'email', values: ['sin-nombre@test.com'] }],
      });
      campaignsService.findByNameAndChannel.mockResolvedValue(null);
      campaignsService.create.mockResolvedValue({ id: 'camp-default' });

      await (service as any).processLead('lead-789');

      expect(campaignsService.create).toHaveBeenCalledWith({
        name: 'Facebook Lead Ads',
        channel: 'facebook',
      });
    });

    it('NO crea el lead si el field_data no trae email', async () => {
      graph.get.mockResolvedValue({
        field_data: [{ name: 'full_name', values: ['Sin Email'] }],
      });

      await (service as any).processLead('lead-000');

      expect(campaignsService.findByNameAndChannel).not.toHaveBeenCalled();
      expect(leadsService.create).not.toHaveBeenCalled();
    });

    it('usa "Sin nombre" como fallback si full_name no viene en field_data', async () => {
      graph.get.mockResolvedValue({
        field_data: [{ name: 'email', values: ['anonimo@test.com'] }],
      });
      campaignsService.findByNameAndChannel.mockResolvedValue({ id: 'camp-1' });

      await (service as any).processLead('lead-111');

      expect(leadsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sin nombre' }),
      );
    });
  });
});