import { PartialType } from '@nestjs/mapped-types';
import { DealStage } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateDealDto } from './create-deal.dto';

export class UpdateDealDto extends PartialType(CreateDealDto) {
  @IsEnum(DealStage)
  @IsOptional()
  stage?: DealStage;
}