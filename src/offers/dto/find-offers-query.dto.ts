import { OfferStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class FindOffersQueryDto {
  @IsEnum(OfferStatus, { message: 'El estado debe ser BORRADOR, ENVIADA, ACEPTADA o RECHAZADA' })
  @IsOptional()
  status?: OfferStatus;

  @IsString({ message: 'El id del deal debe ser un texto' })
  @IsOptional()
  dealId?: string;
}