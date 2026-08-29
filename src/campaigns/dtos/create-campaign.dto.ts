import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
//DTO para crear una campaña
export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name !: string;

  @IsString()
  @IsNotEmpty()
  channel !: string;

  @IsString()
  @IsOptional()
  utmSource?: string;
}