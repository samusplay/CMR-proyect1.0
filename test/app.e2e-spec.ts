import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase } from '../src/utils/database.util';

describe('Citas de inspección: flujo de campo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let admin: { id: string; token: string };
  let inspector: { id: string; token: string };

  let dealA: string; // recorre todo el ciclo de vida de la cita
  let dealB: string; // recibe una inspección: ya no se le puede agendar
  let dealC: string; // prueba de concurrencia

  let firstAppointmentId: string;
  let rescheduledAppointmentId: string;

  const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';

  // Fechas lejanas para que el test no caduque nunca. 09:00 de Bogotá = 14:00 UTC
  const at = (day: number) => `2099-10-${day}T09:00:00-05:00`;

  const http = () => request(app.getHttpServer());
  const get = (url: string, token = admin.token) =>
    http().get(url).set('Authorization', `Bearer ${token}`);
  const post = (url: string, token = admin.token) =>
    http().post(url).set('Authorization', `Bearer ${token}`);
  const patch = (url: string, token = admin.token) =>
    http().patch(url).set('Authorization', `Bearer ${token}`);

  // Crea la inspección mínima de un deal, igual que lo haría la app móvil
  const createInspection = (dealId: string) =>
    post('/inspections').send({
      dealId,
      inspectorName: 'Samuel Pérez',
      systemType: 'TRIFASICO',
      originPoint: 'Tablero principal',
      hasPanelSpace: true,
      requiresDrilling: false,
      differentialProtectionRequired: true,
    });

  // El listener del evento corre en segundo plano: se consulta hasta que la cita cambie (máx. 2 s)
  const waitForStatus = async (appointmentId: string, expected: string) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const res = await get(`/appointments/${appointmentId}`);
      if (res.body.status === expected) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  const createUser = async (name: string, role: string) => {
    const email = `${name.toLowerCase()}-${Date.now()}@econexium.com`;
    const created = await http()
      .post('/users')
      .send({ name, email, password: 'Password123!', role })
      .expect(201);
    const login = await http().post('/auth/login').send({ email, password: 'Password123!' });
    return { id: created.body.id as string, token: login.body.accessToken as string };
  };

  // Lo mismo que hace la app móvil al registrar un cliente nuevo
  const createFieldVisit = async (name: string) => {
    const res = await post('/leads/field-visits')
      .send({
        name,
        email: `${name.toLowerCase().replace(/ /g, '')}@test.com`,
        phone: '3001234567',
        installationType: 'CARGADOR',
      })
      .expect(201);
    return res.body.dealId as string;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await cleanDatabase(prisma);

    admin = await createUser('Admin', 'admin');
    inspector = await createUser('Inspector', 'vendedor');

    dealA = await createFieldVisit('Cliente A');
    dealB = await createFieldVisit('Cliente B');
    dealC = await createFieldVisit('Cliente C');
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('acceso', () => {
    it('GET /appointments sin token responde 401', async () => {
      await http().get('/appointments').expect(401);
    });

    it('POST /appointments sin token responde 401', async () => {
      await http().post('/appointments').send({}).expect(401);
    });
  });

  describe('el registro de campo alimenta la agenda', () => {
    it('POST /leads/field-visits creó el lead y su deal en una sola llamada', async () => {
      const res = await get(`/deals/${dealA}`).expect(200);

      expect(res.body.lead.name).toBe('Cliente A');
      expect(res.body.stage).toBe('NUEVO');
    });

    it('un deal recién creado no tiene inspección (inspection: null), ni en el detalle ni en la lista', async () => {
      const detail = await get(`/deals/${dealA}`).expect(200);
      expect(detail.body.inspection).toBeNull();

      const list = await get('/deals').expect(200);
      const fromList = list.body.find((deal) => deal.id === dealA);
      expect(fromList.inspection).toBeNull();
    });
  });

  describe('agendar: validaciones', () => {
    it('400 si la fecha no trae zona horaria', async () => {
      const res = await post('/appointments')
        .send({ dealId: dealA, scheduledAt: '2099-10-15T09:00:00' })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toContain('zona horaria');
    });

    it('400 si la fecha es pasada', async () => {
      const res = await post('/appointments')
        .send({ dealId: dealA, scheduledAt: '2020-01-01T09:00:00-05:00' })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toContain('futura');
    });

    it('400 si el body trae un campo que no existe (nadie puede firmar a nombre de otro)', async () => {
      const res = await post('/appointments')
        .send({ dealId: dealA, scheduledAt: at(15), scheduledById: admin.id })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toContain('scheduledById');
    });

    it('400 si falta el dealId', async () => {
      await post('/appointments').send({ scheduledAt: at(15) }).expect(400);
    });

    it('404 si el deal no existe', async () => {
      await post('/appointments').send({ dealId: NON_EXISTENT_ID, scheduledAt: at(15) }).expect(404);
    });

    it('404 si el inspector no existe', async () => {
      await post('/appointments')
        .send({ dealId: dealA, scheduledAt: at(15), inspectorId: NON_EXISTENT_ID })
        .expect(404);
    });

    it('ninguna de las peticiones inválidas creó una cita', async () => {
      const res = await get('/appointments').query({ dealId: dealA }).expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('agendar', () => {
    it('201: crea la cita en UTC, firmada por quien llama, con inspector y sin exponer contraseñas', async () => {
      const res = await post('/appointments')
        .send({ dealId: dealA, scheduledAt: at(15), inspectorId: inspector.id, notes: 'Llevar escalera' })
        .expect(201);

      expect(res.body.status).toBe('PROGRAMADA');
      expect(res.body.scheduledAt).toBe('2099-10-15T14:00:00.000Z');
      expect(res.body.scheduledBy.id).toBe(admin.id);
      expect(res.body.inspector.id).toBe(inspector.id);
      expect(res.body.closedBy).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain('password');

      firstAppointmentId = res.body.id;
    });

    it('409: un deal no puede tener dos citas PROGRAMADAS', async () => {
      await post('/appointments').send({ dealId: dealA, scheduledAt: at(17) }).expect(409);

      const res = await get('/appointments').query({ dealId: dealA }).expect(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('consultar la agenda', () => {
    it('GET /appointments/:id devuelve la cita', async () => {
      const res = await get(`/appointments/${firstAppointmentId}`).expect(200);

      expect(res.body.id).toBe(firstAppointmentId);
      expect(res.body.status).toBe('PROGRAMADA');
    });

    it('GET /appointments/:id responde 404 si no existe', async () => {
      await get(`/appointments/${NON_EXISTENT_ID}`).expect(404);
    });

    it('filtra por rango de fechas: la incluye cuando el rango la cubre', async () => {
      const res = await get('/appointments')
        .query({ from: '2099-10-01T00:00:00Z', to: '2099-10-31T23:59:59Z' })
        .expect(200);

      expect(res.body.map((appointment) => appointment.id)).toContain(firstAppointmentId);
    });

    it('filtra por rango de fechas: no la incluye cuando el rango no la cubre', async () => {
      const res = await get('/appointments')
        .query({ from: '2098-01-01T00:00:00Z', to: '2098-12-31T23:59:59Z' })
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('filtra por estado: PROGRAMADA la incluye', async () => {
      const res = await get('/appointments').query({ status: 'PROGRAMADA' }).expect(200);

      expect(res.body.map((appointment) => appointment.id)).toContain(firstAppointmentId);
    });

    it('filtra por estado: COMPLETADA no devuelve nada todavía', async () => {
      const res = await get('/appointments').query({ status: 'COMPLETADA' }).expect(200);

      expect(res.body).toEqual([]);
    });

    it('filtra por inspector: devuelve las citas de ese inspector', async () => {
      const res = await get('/appointments').query({ inspectorId: inspector.id }).expect(200);

      expect(res.body.map((appointment) => appointment.id)).toContain(firstAppointmentId);
    });

    it('filtra por inspector: otro usuario no ve esa cita', async () => {
      const res = await get('/appointments').query({ inspectorId: admin.id }).expect(200);

      expect(res.body).toEqual([]);
    });

    it('400 si una fecha del filtro es inválida', async () => {
      await get('/appointments').query({ from: 'basura' }).expect(400);
    });

    it('400 si el estado del filtro no existe', async () => {
      await get('/appointments').query({ status: 'INVENTADO' }).expect(400);
    });

    it('400 si "from" es posterior a "to"', async () => {
      await get('/appointments')
        .query({ from: '2099-10-31T00:00:00Z', to: '2099-10-01T00:00:00Z' })
        .expect(400);
    });
  });

  describe('reprogramar y cancelar, con trazabilidad', () => {
    it('400 si se reprograma sin motivo', async () => {
      await patch(`/appointments/${firstAppointmentId}/reschedule`)
        .send({ scheduledAt: at(16) })
        .expect(400);
    });

    it('400 si el body intenta mover la cita a otro deal', async () => {
      await patch(`/appointments/${firstAppointmentId}/reschedule`)
        .send({ scheduledAt: at(16), reason: 'x', dealId: dealB })
        .expect(400);
    });

    it('400 si se reprograma a una fecha pasada', async () => {
      await patch(`/appointments/${firstAppointmentId}/reschedule`)
        .send({ scheduledAt: '2020-01-01T09:00:00-05:00', reason: 'x' })
        .expect(400);
    });

    it('404 si la cita a reprogramar no existe', async () => {
      await patch(`/appointments/${NON_EXISTENT_ID}/reschedule`)
        .send({ scheduledAt: at(16), reason: 'x' })
        .expect(404);
    });

    it('200: reprogramar crea una cita nueva, firmada por quien la reprograma, y hereda notas e inspector', async () => {
      const res = await patch(`/appointments/${firstAppointmentId}/reschedule`, inspector.token)
        .send({ scheduledAt: at(16), reason: 'El cliente pidió otro día' })
        .expect(200);

      expect(res.body.id).not.toBe(firstAppointmentId);
      expect(res.body.status).toBe('PROGRAMADA');
      expect(res.body.scheduledAt).toBe('2099-10-16T14:00:00.000Z');
      expect(res.body.scheduledBy.id).toBe(inspector.id);
      expect(res.body.inspector.id).toBe(inspector.id);
      expect(res.body.notes).toBe('Llevar escalera');

      rescheduledAppointmentId = res.body.id;
    });

    it('la cadena del deal queda completa: la vieja cerrada con quién, cuándo y por qué', async () => {
      const res = await get('/appointments').query({ dealId: dealA }).expect(200);

      expect(res.body).toHaveLength(2);
      const [old, current] = res.body; // ordenadas por fecha: 15 y 16

      expect(old.id).toBe(firstAppointmentId);
      expect(old.status).toBe('REPROGRAMADA');
      expect(old.reason).toBe('El cliente pidió otro día');
      expect(old.closedBy.id).toBe(inspector.id);
      expect(old.closedAt).not.toBeNull();

      expect(current.id).toBe(rescheduledAppointmentId);
      expect(current.status).toBe('PROGRAMADA');
      expect(current.closedBy).toBeNull();
    });

    it('409 si se intenta reprogramar una cita que ya fue reprogramada', async () => {
      await patch(`/appointments/${firstAppointmentId}/reschedule`)
        .send({ scheduledAt: at(18), reason: 'otra vez' })
        .expect(409);
    });

    it('400 si se cancela sin motivo', async () => {
      await patch(`/appointments/${rescheduledAppointmentId}/cancel`).send({}).expect(400);
    });

    it('200: cancelar guarda motivo, quién y cuándo', async () => {
      const res = await patch(`/appointments/${rescheduledAppointmentId}/cancel`)
        .send({ reason: 'Cliente no disponible' })
        .expect(200);

      expect(res.body.status).toBe('CANCELADA');
      expect(res.body.reason).toBe('Cliente no disponible');
      expect(res.body.closedBy.id).toBe(admin.id);
      expect(res.body.closedAt).not.toBeNull();
    });

    it('409 si se cancela una cita que ya está cancelada', async () => {
      await patch(`/appointments/${rescheduledAppointmentId}/cancel`)
        .send({ reason: 'otra vez' })
        .expect(409);
    });

    it('409 si se intenta reprogramar una cita cancelada', async () => {
      await patch(`/appointments/${rescheduledAppointmentId}/reschedule`)
        .send({ scheduledAt: at(18), reason: 'x' })
        .expect(409);
    });

    it('201: tras cancelar se puede agendar de nuevo, y el historial conserva las tres filas', async () => {
      await post('/appointments')
        .send({ dealId: dealA, scheduledAt: at(20), notes: 'Segunda visita' })
        .expect(201);

      const res = await get('/appointments').query({ dealId: dealA }).expect(200);

      expect(res.body.map((appointment) => appointment.status)).toEqual([
        'REPROGRAMADA',
        'CANCELADA',
        'PROGRAMADA',
      ]);
    });
  });

  describe('inspección y agenda', () => {
    it('POST /inspections crea la inspección del deal B', async () => {
      await post('/inspections')
        .send({
          dealId: dealB,
          inspectorName: 'Samuel Pérez',
          systemType: 'TRIFASICO',
          originPoint: 'Tablero principal',
          hasPanelSpace: true,
          requiresDrilling: false,
          differentialProtectionRequired: true,
        })
        .expect(201);
    });

    it('409: un deal con inspección ya no se puede agendar', async () => {
      await post('/appointments').send({ dealId: dealB, scheduledAt: at(15) }).expect(409);
    });

    it('lo que ve la pestaña Visitas (deals sin inspección) deja a A y C, y saca a B', async () => {
      const res = await get('/deals').expect(200);

      const pending = res.body.filter((deal) => !deal.inspection).map((deal) => deal.id);

      expect(pending).toEqual(expect.arrayContaining([dealA, dealC]));
      expect(pending).not.toContain(dealB);
    });

    it('al crear la inspección, la cita PROGRAMADA del deal pasa a COMPLETADA', async () => {
      const dealD = await createFieldVisit('Cliente D');
      const created = await post('/appointments')
        .send({ dealId: dealD, scheduledAt: at(25) })
        .expect(201);
      expect(created.body.status).toBe('PROGRAMADA');

      await createInspection(dealD).expect(201);
      await waitForStatus(created.body.id, 'COMPLETADA');

      const res = await get(`/appointments/${created.body.id}`).expect(200);
      expect(res.body.status).toBe('COMPLETADA');
      expect(res.body.closedAt).not.toBeNull();
      expect(res.body.closedBy).toBeNull(); // la cerró el sistema, no una persona
    });

    it('solo se completa la cita abierta: la reprogramada del historial se conserva', async () => {
      const dealE = await createFieldVisit('Cliente E');
      const first = await post('/appointments')
        .send({ dealId: dealE, scheduledAt: at(25) })
        .expect(201);
      const second = await patch(`/appointments/${first.body.id}/reschedule`)
        .send({ scheduledAt: at(26), reason: 'El cliente pidió otro día' })
        .expect(200);

      await createInspection(dealE).expect(201);
      await waitForStatus(second.body.id, 'COMPLETADA');

      const res = await get('/appointments').query({ dealId: dealE }).expect(200);
      expect(res.body.map((appointment) => appointment.status)).toEqual([
        'REPROGRAMADA',
        'COMPLETADA',
      ]);
    });

    it('si el deal no tenía cita, crear su inspección no inventa ninguna', async () => {
      // El deal B recibió su inspección arriba sin haber agendado nunca
      const res = await get('/appointments').query({ dealId: dealB }).expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('concurrencia', () => {
    it('dos peticiones simultáneas para el mismo deal: una gana (201) y la otra recibe 409', async () => {
      const send = () => post('/appointments').send({ dealId: dealC, scheduledAt: at(22) });

      const [first, second] = await Promise.all([send(), send()]);

      expect([first.status, second.status].sort((a, b) => a - b)).toEqual([201, 409]);

      const open = await get('/appointments')
        .query({ dealId: dealC, status: 'PROGRAMADA' })
        .expect(200);
      expect(open.body).toHaveLength(1);
    });
  });
});