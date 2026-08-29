import { InstallationType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateDealDto {
  @IsString()
  @IsNotEmpty()
  leadId !: string;

  @IsEnum(InstallationType)
  installationType !: InstallationType;

  @IsInt()
  @IsPositive()
  estimatedValue !: number;

  @IsDateString()
  @IsOptional()
  expectedCloseDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  assignedToId?: string;
}