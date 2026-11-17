import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateOfferDto } from './create-offer.dto';

// El deal de una oferta no se puede cambiar. Si se envía `items`, reemplaza todas las líneas.
export class UpdateOfferDto extends PartialType(OmitType(CreateOfferDto, ['dealId'] as const)) {}