import { Injectable, Logger } from '@nestjs/common';
import { CampaignsService } from '../campaigns/campaigns.service';
import { LeadsService } from '../leads/leads.service';
import { FacebookGraphService } from './facebook-graph.service';

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);

  constructor(
    //inyectamos los servicios 
    private graph: FacebookGraphService,
    private leadsService: LeadsService,
    private campaignsService: CampaignsService,
  ) {}

  handleWebhookEvent(body: any) {
    const entries = body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        if (change.field === 'leadgen') {
          const leadgenId = change.value?.leadgen_id;
          if (leadgenId) {
            this.processLead(leadgenId).catch((err) =>
              this.logger.error(`Error procesando lead ${leadgenId}`, err),
            );
          }
        }
      }
    }
  }

  private async processLead(leadgenId: string) {
    const data = await this.graph.get(leadgenId, {
      fields: 'field_data,campaign_name,ad_name',
    });

    const getField = (name: string) =>
      data.field_data?.find((f: any) => f.name === name)?.values?.[0];

    const name = getField('full_name') ?? 'Sin nombre';
    const email = getField('email');
    const phone = getField('phone_number');

    if (!email) {
      this.logger.warn(`Lead ${leadgenId} llegó sin email, se omite`);
      return;
    }

    const campaignName = data.campaign_name ?? data.ad_name ?? 'Facebook Lead Ads';
    let campaign = await this.campaignsService.findByNameAndChannel(campaignName, 'facebook');
    if (!campaign) {
      campaign = await this.campaignsService.create({ name: campaignName, channel: 'facebook' } as any);
    }

    await this.leadsService.create({ name, email, phone, campaignId: campaign.id } as any);
    this.logger.log(`Lead creado desde Facebook: ${email}`);
  }
}