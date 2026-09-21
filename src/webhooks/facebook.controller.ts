import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FacebookService } from './facebook.service';

@Controller('webhooks/facebook')
export class FacebookController {
  constructor(
    private configService: ConfigService,
    private facebookService: FacebookService,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const verifyToken = this.configService.get<string>('FACEBOOK_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }

    throw new ForbiddenException('Token de verificación inválido');
  }

  @Post()
  @HttpCode(200)
  receive(@Body() body: any) {
    this.facebookService.handleWebhookEvent(body);
    return 'EVENT_RECEIVED';
  }
}