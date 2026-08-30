import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  address?: string;

  @IsDateString()
  @IsOptional()
  installationDate?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}