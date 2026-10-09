// dto/is-iso-date-with-timezone.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

export function IsIsoDateWithTimezone() {
  return applyDecorators(
    IsISO8601({}, { message: 'La fecha debe estar en formato ISO 8601' }),
    Matches(/(Z|[+-]\d{2}:\d{2})$/, {
      message: 'La fecha debe incluir zona horaria, ej. 2026-10-12T09:00:00-05:00',
    }),
  );
}