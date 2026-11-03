import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/send-email';
import { isTherapeuticText } from '../src/context/LidactaContext';
import { INITIAL_SYSTEM_ALERTS } from '../src/data/mockData';

describe('Implementación Completa de Alerta de Límite Terapéutico y Bitácora en Panel Admin', () => {
  it('1. Debe despachar exitosamente la Alerta de Límite Terapéutico vía Resend a hola@taniapadierna.com', async () => {
    let responseStatus = 0;
    let responseJson: any = null;

    const req: any = {
      method: 'POST',
      body: {
        to: 'hola@taniapadierna.com',
        email: 'hola@taniapadierna.com',
        leaderName: 'Roberto Gómez',
        leaderEmail: 'roberto.gomez@nexus-auto.com',
        companyName: 'Industrias Nexus Automotriz',
        currentStage: 2,
        stageName: 'Etapa 2 (Analizar y ver desde otras perspectivas)',
        dateTimeFormatted: '03 de noviembre de 2026, 11:30 hrs',
        contextSummary: 'Líder reportó episodios de crisis de angustia y llanto incontrolable ante presiones operativas. Se aplicó derivación respetuosa hacia profesionales de la salud mental / PAE.',
        type: 'therapeutic_alert',
        subject: '[ALERTA LIDACTA] Detección de Caso con Naturaleza Terapéutica',
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

  it('2. El detector de texto terapéutico (isTherapeuticText) debe identificar palabras clave clínicas y de crisis sin falsos positivos en liderazgo', () => {
    // Casos terapéuticos / clínicos
    assert.equal(isTherapeuticText('Tengo un ataque de pánico y no sé qué hacer con mi equipo'), true);
    assert.equal(isTherapeuticText('Siento una depresión profunda y creo que necesito ver a un psiquiatra'), true);
    assert.equal(isTherapeuticText('Me recetaron un ansiolítico para calmar la crisis de angustia'), true);
    assert.equal(isTherapeuticText('Ya no quiero vivir, siento ganas de morir con tanta presión'), true);

    // Casos legítimos de liderazgo y gestión que NO deben activar alerta terapéutica
    assert.equal(isTherapeuticText('Necesito preparar una conversación difícil con un operador que llega tarde'), false);
    assert.equal(isTherapeuticText('Quiero mejorar la delegación de tareas operativas en mi turno'), false);
    assert.equal(isTherapeuticText('¿Cómo puedo dar retroalimentación constructiva sobre el cumplimiento de tiempos?'), false);
  });

  it('3. INITIAL_SYSTEM_ALERTS debe contener las alertas requeridas (Límite Terapéutico e Inactividad Día 8) con esquema auditado', () => {
    assert.ok(Array.isArray(INITIAL_SYSTEM_ALERTS));
    assert.ok(INITIAL_SYSTEM_ALERTS.length >= 2);

    const therapeuticAlert = INITIAL_SYSTEM_ALERTS.find((a) => a.type === 'therapeutic_limit');
    assert.ok(therapeuticAlert, 'Debe existir al menos una alerta de límite terapéutico');
    assert.equal(therapeuticAlert.typeName, 'Límite Terapéutico');
    assert.equal(therapeuticAlert.status, 'Correo Enviado');
    assert.equal(therapeuticAlert.emailRecipient, 'hola@taniapadierna.com');
    assert.ok(therapeuticAlert.leaderName);
    assert.ok(therapeuticAlert.companyName);
    assert.ok(therapeuticAlert.caseSummary);
    assert.ok(therapeuticAlert.timestamp);

    const inactivityAlert = INITIAL_SYSTEM_ALERTS.find((a) => a.type === 'inactivity_day8');
    assert.ok(inactivityAlert, 'Debe existir al menos una alerta de inactividad de día 8');
    assert.equal(inactivityAlert.typeName, 'Inactividad Día 8');
    assert.equal(inactivityAlert.status, 'Correo Enviado');
    assert.equal(inactivityAlert.emailRecipient, 'hola@taniapadierna.com');
    assert.ok(inactivityAlert.leaderName);
    assert.ok(inactivityAlert.companyName);
    assert.ok(inactivityAlert.caseSummary);
    assert.ok(inactivityAlert.timestamp);
  });
});
