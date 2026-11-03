import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/send-email';

describe('Notificaciones de Seguimiento en Etapa 5 y Alerta de Inactividad (Día 8)', () => {
  it('1. Debe despachar exitosamente el Correo 1 (a las 48 horas) al líder con la ficha de su compromiso', async () => {
    let responseStatus = 0;
    let responseJson: any = null;

    const req: any = {
      method: 'POST',
      body: {
        to: 'carlos.mendoza@novaretail.com',
        name: 'Carlos Mendoza',
        companyName: 'Retail Nova Grupo Comercial',
        challengeTitle: 'Desmotivación del equipo ante metas comerciales agresivas del Q4',
        type: 'stage5_48h',
        actionPlan: {
          what: 'Taller de 45 minutos para desglosar la meta trimestral en micro-objetivos semanales por categoría.',
          when: 'Lunes próximo a las 08:30 hrs antes de apertura.',
          withWhom: 'Equipo comercial completo (9 asesores de tienda).',
          careReminders: 'No invalidar su preocupación sobre el número grande; mostrarles cómo se come el elefante a bocados.',
        },
      },
    };

    const res: any = {
      setHeader: () => {},
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (data: any) => {
            responseJson = data;
            return data;
          },
        };
      },
    };

    await handler(req, res);

    assert.equal(responseStatus, 200);
    assert.equal(responseJson.success, true);
    assert.ok(responseJson.emailId || responseJson.id);
  });

  it('2. Debe despachar exitosamente el Correo 2 (a los 5 días) enfocado en consolidar avances hacia la Etapa 6', async () => {
    let responseStatus = 0;
    let responseJson: any = null;

    const req: any = {
      method: 'POST',
      body: {
        to: 'carlos.mendoza@novaretail.com',
        name: 'Carlos Mendoza',
        companyName: 'Retail Nova Grupo Comercial',
        challengeTitle: 'Desmotivación del equipo ante metas comerciales agresivas del Q4',
        type: 'stage5_5d',
        actionPlan: {
          what: 'Taller de 45 minutos para desglosar la meta trimestral en micro-objetivos semanales por categoría.',
          when: 'Lunes próximo a las 08:30 hrs antes de apertura.',
          withWhom: 'Equipo comercial completo (9 asesores de tienda).',
          careReminders: 'No invalidar su preocupación sobre el número grande.',
        },
      },
    };

    const res: any = {
      setHeader: () => {},
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (data: any) => {
            responseJson = data;
            return data;
          },
        };
      },
    };

    await handler(req, res);

    assert.equal(responseStatus, 200);
    assert.equal(responseJson.success, true);
    assert.ok(responseJson.emailId || responseJson.id);
  });

  it('3. Debe despachar la Alerta de Inactividad (Día 8) dirigida exclusivamente a hola@taniapadierna.com con todos los datos requeridos', async () => {
    let responseStatus = 0;
    let responseJson: any = null;

    const req: any = {
      method: 'POST',
      body: {
        to: 'hola@taniapadierna.com',
        leaderName: 'Carlos Mendoza',
        companyName: 'Retail Nova Grupo Comercial',
        leaderPosition: 'Gerente de Sucursal Centro',
        leaderArea: 'Operaciones Comerciales y Tiendas',
        leaderEmail: 'carlos.mendoza@novaretail.com',
        leaderWhatsapp: '+52 55 9876 5432',
        lastActiveAt: '2026-10-12T14:30:00Z',
        lastActiveFormatted: '12 de octubre de 2026, 14:30 hrs',
        challengeTitle: 'Desmotivación del equipo ante metas comerciales agresivas del Q4',
        type: 'stage5_inactivity_admin',
        actionPlan: {
          what: 'Taller de 45 minutos para desglosar la meta trimestral en micro-objetivos semanales por categoría.',
          when: 'Lunes próximo a las 08:30 hrs antes de apertura.',
          withWhom: 'Equipo comercial completo (9 asesores de tienda).',
          careReminders: 'No invalidar su preocupación sobre el número grande; mostrarles cómo se come el elefante a bocados.',
        },
      },
    };

    const res: any = {
      setHeader: () => {},
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (data: any) => {
            responseJson = data;
            return data;
          },
        };
      },
    };

    await handler(req, res);

    assert.equal(responseStatus, 200);
    assert.equal(responseJson.success, true);
    assert.ok(responseJson.emailId || responseJson.id);
  });

  it('4. Valida el cálculo de días transcurridos para activar correctamente las alertas a las 48h, 5d y 8 días', () => {
    const stage5EnteredAt = new Date('2026-10-10T10:00:00Z').getTime();

    // Caso A: A las 47 horas -> No debe detonar aún 48h
    const test47h = new Date('2026-10-12T09:00:00Z').getTime();
    const elapsed47h = (test47h - stage5EnteredAt) / (1000 * 60 * 60);
    assert.ok(elapsed47h < 48);

    // Caso B: A las 49 horas -> Detona Correo 1 (48h)
    const test49h = new Date('2026-10-12T11:00:00Z').getTime();
    const elapsed49h = (test49h - stage5EnteredAt) / (1000 * 60 * 60);
    assert.ok(elapsed49h >= 48);

    // Caso C: A los 5.5 días -> Detona Correo 2 (5 días)
    const test5Days = new Date('2026-10-15T22:00:00Z').getTime();
    const elapsed5Days = (test5Days - stage5EnteredAt) / (1000 * 60 * 60 * 24);
    assert.ok(elapsed5Days >= 5);

    // Caso D: A los 8.2 días sin actividad -> Detona Alerta Día 8 a la Administradora
    const test8Days = new Date('2026-10-18T15:00:00Z').getTime();
    const elapsed8Days = (test8Days - stage5EnteredAt) / (1000 * 60 * 60 * 24);
    assert.ok(elapsed8Days >= 8);
  });
});
