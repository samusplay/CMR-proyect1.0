import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCampaignDto {
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  name !: string;

  @IsString({ message: 'El canal debe ser un texto' })
  @IsNotEmpty({ message: 'El canal no puede estar vacío' })
  channel !: string;

  @IsString({ message: 'El origen (utmSource) debe ser un texto' })
  @IsOptional()
  utmSource?: string;
}