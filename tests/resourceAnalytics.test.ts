import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERNAL_LIBRARY_CATALOG,
  EXTERNAL_SOURCES_CATALOG,
  INITIAL_RECOMMENDED_RESOURCES,
} from '../src/data/mockData.js';
import type { RecommendedResourceItem, ResourceOrigin } from '../src/types/lidacta.js';

describe('Analítica de Recursos Recomendados por Lidacta', () => {
  it('debe contener las 7 herramientas prácticas clave de la Biblioteca Interna (Bloque 3)', () => {
    assert.equal(INTERNAL_LIBRARY_CATALOG.length >= 7, true);
    const titles = INTERNAL_LIBRARY_CATALOG.map((t) => t.title);

    assert.ok(titles.some((t) => t.includes('Retroalimentación en Piso') || t.includes('E-H-I')));
    assert.ok(titles.some((t) => t.includes('Matriz de Delegación Progresiva')));
    assert.ok(titles.some((t) => t.includes('Protocolo de Conversación con Personal') || t.includes('Mayor Antigüedad')));
    assert.ok(titles.some((t) => t.includes('Plantilla de Acuerdos Operativos') || t.includes('Compromisos Mutuos')));
    assert.ok(titles.some((t) => t.includes('Checklist de Desescalamiento')));
    assert.ok(titles.some((t) => t.includes('Sprints Semanales')));
    assert.ok(titles.some((t) => t.includes('Rúbrica de Empoderamiento')));
  });

  it('debe contener el catálogo delimitado de Fuentes Externas (HBR, CCL, MIT Sloan, etc.)', () => {
    assert.equal(EXTERNAL_SOURCES_CATALOG.length >= 6, true);
    const sources = EXTERNAL_SOURCES_CATALOG.map((s) => s.authorOrSource);

    assert.ok(sources.some((s) => s.includes('Harvard Business Review')));
    assert.ok(sources.some((s) => s.includes('Center for Creative Leadership')));
    assert.ok(sources.some((s) => s.includes('MIT Sloan')));
    assert.ok(sources.some((s) => s.includes('Edmondson')));
    assert.ok(sources.some((s) => s.includes('Kim Scott')));
    assert.ok(sources.some((s) => s.includes('Gallup')));
  });

  it('debe clasificar el origen automáticamente entre "internal" y "external"', () => {
    const detectOrigin = (title: string): ResourceOrigin => {
      const isInternal = INTERNAL_LIBRARY_CATALOG.some(
        (c) => c.title.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(c.title.toLowerCase())
      );
      return isInternal ? 'internal' : 'external';
    };

    assert.equal(detectOrigin('Guía de Retroalimentación en Piso (Modelo E-H-I: Evento, Hecho, Impacto)'), 'internal');
    assert.equal(detectOrigin('Matriz de Delegación Progresiva y Puntos de Control'), 'internal');
    assert.equal(detectOrigin('The Feedback Fallacy (Marcus Buckingham & Ashley Goodall)'), 'external');
    assert.equal(detectOrigin('Modelo SBI (Situation - Behavior - Impact)'), 'external');
  });

  it('debe calcular métricas globales y porcentajes de uso correctamente', () => {
    const list: RecommendedResourceItem[] = INITIAL_RECOMMENDED_RESOURCES;
    const total = list.length;
    const internalCount = list.filter((r) => r.origin === 'internal').length;
    const externalCount = list.filter((r) => r.origin === 'external').length;

    assert.equal(internalCount + externalCount, total);
    assert.ok(total > 0);

    const internalPercent = Math.round((internalCount / total) * 100);
    const externalPercent = Math.round((externalCount / total) * 100);

    assert.ok(internalPercent >= 0 && internalPercent <= 100);
    assert.ok(externalPercent >= 0 && externalPercent <= 100);
    assert.equal(internalPercent + externalPercent, 100);

    const uniqueLeaders = new Set(list.map((r) => r.leaderId));
    assert.ok(uniqueLeaders.size >= 3);
  });

  it('debe filtrar correctamente por líder y origen en tiempo real', () => {
    const list: RecommendedResourceItem[] = INITIAL_RECOMMENDED_RESOURCES;

    // Filter by leader Roberto (user_leader_roberto)
    const robertoItems = list.filter((r) => r.leaderId === 'user_leader_roberto');
    assert.ok(robertoItems.length >= 2);
    assert.ok(robertoItems.every((r) => r.leaderId === 'user_leader_roberto'));

    // Filter by origin 'internal'
    const internalOnly = list.filter((r) => r.origin === 'internal');
    assert.ok(internalOnly.every((r) => r.origin === 'internal'));

    // Filter by origin 'external'
    const externalOnly = list.filter((r) => r.origin === 'external');
    assert.ok(externalOnly.every((r) => r.origin === 'external'));
  });

  it('debe registrar recursos de forma 100% invisible para el líder sin exigir confirmación', () => {
    // Simulated silent recording function
    const mockStorage: RecommendedResourceItem[] = [...INITIAL_RECOMMENDED_RESOURCES];
    const recordSilentRecommendation = (
      resourceTitle: string,
      origin: ResourceOrigin,
      categoryOrTool: string,
      leaderId: string,
      leaderName: string,
      leaderEmail: string,
      companyId: string,
      companyName: string,
      mentorshipId: string,
      challengeTitle: string,
      theme: string,
      stage: 2 | 3 | 4 | 5 | 6
    ) => {
      const newItem: RecommendedResourceItem = {
        id: `rec_${Date.now()}_test`,
        resourceTitle,
        origin,
        categoryOrTool,
        leaderId,
        leaderName,
        leaderEmail,
        companyId,
        companyName,
        mentorshipId,
        challengeTitle,
        theme,
        stage,
        stageName: `Etapa ${stage}`,
        recommendedAt: new Date().toISOString(),
      };
      mockStorage.unshift(newItem);
      return newItem;
    };

    const initialCount = mockStorage.length;
    const added = recordSilentRecommendation(
      'Guía EHI: Escuchar, Hechos, Impacto',
      'internal',
      'Herramienta Práctica (Bloque 3)',
      'usr_nexus_leader1',
      'Roberto Gómez',
      'roberto.gomez@nexustech.com',
      'comp_nexus',
      'Nexus Technologies',
      'ment_101',
      'Resistencia al cambio en veterano técnico',
      'Gestión del Cambio & Veteranos',
      2
    );

    assert.equal(mockStorage.length, initialCount + 1);
    assert.equal(added.origin, 'internal');
    assert.equal(added.stage, 2);
    assert.equal(added.leaderId, 'usr_nexus_leader1');
  });

  it('debe contener campos de Utilidad y Dificultad estimadas por contexto en todos los recursos iniciales', () => {
    const list = INITIAL_RECOMMENDED_RESOURCES;
    assert.ok(list.length >= 10);

    for (const item of list) {
      assert.ok(
        item.estimatedUtility === 'Muy Alta' ||
        item.estimatedUtility === 'Alta' ||
        item.estimatedUtility === 'Media',
        `estimatedUtility inválido en ${item.id}: ${item.estimatedUtility}`
      );
      assert.ok(
        item.estimatedDifficulty === 'Baja' ||
        item.estimatedDifficulty === 'Media' ||
        item.estimatedDifficulty === 'Alta',
        `estimatedDifficulty inválido en ${item.id}: ${item.estimatedDifficulty}`
      );
      assert.ok(typeof item.utilityReason === 'string' && item.utilityReason.length > 5);
      assert.ok(typeof item.resistanceOrDoubtNotes === 'string' && item.resistanceOrDoubtNotes.length > 5);
    }
  });

  it('debe filtrar adecuadamente por nivel de dificultad estimada (Baja, Media, Alta)', () => {
    const list = INITIAL_RECOMMENDED_RESOURCES;
    const bajaItems = list.filter((r) => r.estimatedDifficulty === 'Baja');
    const mediaItems = list.filter((r) => r.estimatedDifficulty === 'Media');
    const altaItems = list.filter((r) => r.estimatedDifficulty === 'Alta');

    assert.ok(bajaItems.length > 0);
    assert.ok(mediaItems.length > 0);
    assert.ok(altaItems.length > 0);
    assert.equal(bajaItems.length + mediaItems.length + altaItems.length, list.length);
  });

  it('debe garantizar la prioridad de la Biblioteca Interna (Bloque 3) antes que fuentes externas', () => {
    const list = INITIAL_RECOMMENDED_RESOURCES;
    const internalCount = list.filter((r) => r.origin === 'internal').length;
    const externalCount = list.filter((r) => r.origin === 'external').length;

    // La biblioteca interna debe representar la mayoría de los recursos recomendados
    assert.ok(internalCount > externalCount, 'La Biblioteca Interna debe ser la fuente prioritaria');
  });
});
