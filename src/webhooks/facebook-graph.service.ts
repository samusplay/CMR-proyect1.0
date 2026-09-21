import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GRAPH_API_VERSION = 'v26.0';

@Injectable()
export class FacebookGraphService {
  private readonly logger = new Logger(FacebookGraphService.name);

  constructor(private configService: ConfigService) {}

 async get(path: string, params: Record<string, string> = {}) {
  const token = this.configService.get<string>('FACEBOOK_PAGE_ACCESS_TOKEN');

  if (!token) {
    throw new Error('FACEBOOK_PAGE_ACCESS_TOKEN no está configurado en el .env');
  }

  const query = new URLSearchParams({ ...params, access_token: token });
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${path}?${query.toString()}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    this.logger.error(`Graph API rechazó ${path}: ${JSON.stringify(data.error)}`);
    throw new Error(`Facebook Graph API error: ${data.error.message}`);
  }

  return data;
}
}