import { Module } from '@nestjs/common';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { LeadsModule } from '../leads/leads.module';
import { FacebookGraphService } from './facebook-graph.service';
import { FacebookController } from './facebook.controller';
import { FacebookService } from './facebook.service';

@Module({
  imports: [LeadsModule, CampaignsModule],
  controllers: [FacebookController],
  providers: [FacebookService, FacebookGraphService], 
  exports: [FacebookGraphService],
})
export class WebhooksModule {}