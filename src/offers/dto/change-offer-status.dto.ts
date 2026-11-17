import { OfferStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeOfferStatusDto {
  @IsEnum(OfferStatus, { message: 'El estado debe ser BORRADOR, ENVIADA, ACEPTADA o RECHAZADA' })
  status!: OfferStatus;
}