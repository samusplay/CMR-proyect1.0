import type { OfferStatus } from '@prisma/client';

// Para cada estado, a cuáles se puede pasar. Agregar un estado o una regla es agregar una fila.
export const ALLOWED_TRANSITIONS: Record<OfferStatus, readonly OfferStatus[]> = {
  BORRADOR: ['ENVIADA'],
  ENVIADA: ['ACEPTADA', 'RECHAZADA', 'BORRADOR'], // BORRADOR = reabrir para corregir
  ACEPTADA: [], // final: ya se convirtió en venta
  RECHAZADA: ['BORRADOR'], // reabrir para renegociar
};

export const canTransition = (from: OfferStatus, to: OfferStatus): boolean =>
  ALLOWED_TRANSITIONS[from].includes(to);

// Solo un borrador se puede editar. Una oferta enviada ya la tiene el cliente
export const isEditable = (status: OfferStatus): boolean => status === 'BORRADOR';