import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeText,
  toTitleCase,
  mapToCanonicalSkill,
  consolidateSkills,
  normalizeExistingSessionSkills,
  formatStageTwoSkillsWithEvidence,
  SKILL_EVIDENCE_STAGES,
  CANONICAL_LEADERSHIP_SKILLS,
  SkillReconsiderationDirective,
  INSUFFICIENT_EVIDENCE_MESSAGE,
  IncomingSkillCandidate,
  formatEvidenceRecord,
  getActiveSkillEntries,
  getActiveSkillNames,
  createSkillEntriesFromLegacy,
  consolidateSkillEntries,
  LeadershipSkillEntry,
  ObservedEvidenceRecord,
  SkillReconsiderationRecord,
} from '../src/utils/skillsConsolidator';

describe('Consolidación y Deduplicación de Habilidades de Liderazgo (skillsConsolidator)', () => {
  // =========================================================================
  // CRITERIO 1: Normalización de mayúsculas, minúsculas, espacios y acentos
  // =========================================================================
  describe('Criterio 1: Normalización de mayúsculas, minúsculas y acentos', () => {
    it('debe normalizar textos removiendo acentos, puntuación y espacios extras', () => {
      assert.equal(normalizeText('  Comunicación   Asertiva!  '), 'comunicacion asertiva');
      assert.equal(normalizeText('REGULACIÓN EMOCIONAL...'), 'regulacion emocional');
      assert.equal(normalizeText('resolución de conflictos;'), 'resolucion de conflictos');
    });

    it('debe mapear variantes con diferentes tildes y mayúsculas a la misma habilidad canónica', () => {
      const v1 = mapToCanonicalSkill('comunicacion asertiva');
      const v2 = mapToCanonicalSkill('COMUNICACIÓN ASERTIVA');
      const v3 = mapToCanonicalSkill('Comunicación Asertiva');
      const v4 = mapToCanonicalSkill('  coMuniCaciOn  aseRtiva  ');

      assert.ok(v1 && v2 && v3 && v4);
      assert.equal(v1.canonicalName, 'Comunicación Asertiva y Firmeza Empática');
      assert.equal(v2.canonicalName, 'Comunicación Asertiva y Firmeza Empática');
      assert.equal(v3.canonicalName, 'Comunicación Asertiva y Firmeza Empática');
      assert.equal(v4.canonicalName, 'Comunicación Asertiva y Firmeza Empática');
      assert.equal(v1.cluster, 'comunicacion');
    });

    it('debe aplicar formato TitleCase respetando conectores gramaticales en español', () => {
      assert.equal(toTitleCase('comunicacion de equipos y liderazgo'), 'Comunicacion de Equipos y Liderazgo');
      assert.equal(toTitleCase('gestion del cambio para directores'), 'Gestion del Cambio para Directores');
    });
  });

  // =========================================================================
  // CRITERIO 2: Consolidación de sinónimos y no-fusión de habilidades distintas
  // =========================================================================
  describe('Criterio 2: Consolidación de sinónimos sin fusionar habilidades distintas', () => {
    it('debe consolidar sinónimos y variantes conceptuales hacia la misma habilidad canónica', () => {
      const syn1 = mapToCanonicalSkill('asertividad');
      const syn2 = mapToCanonicalSkill('comunicación directa');
      const syn3 = mapToCanonicalSkill('firmeza empática');
      const syn4 = mapToCanonicalSkill('postura clara');

      assert.ok(syn1 && syn2 && syn3 && syn4);
      assert.equal(syn1.canonicalName, 'Comunicación Asertiva y Firmeza Empática');
      assert.equal(syn2.canonicalName, 'Comunicación Asertiva y Firmeza Empática');
      assert.equal(syn3.canonicalName, 'Comunicación Asertiva y Firmeza Empática');
      assert.equal(syn4.canonicalName, 'Comunicación Asertiva y Firmeza Empática');
      assert.equal(syn1.cluster, syn2.cluster);
    });

    it('debe consolidar sinónimos de delegación en un único cluster', () => {
      const d1 = mapToCanonicalSkill('soltar el control');
      const d2 = mapToCanonicalSkill('delegar');
      const d3 = mapToCanonicalSkill('empoderamiento del equipo');

      assert.ok(d1 && d2 && d3);
      assert.equal(d1.canonicalName, 'Delegación Efectiva y Empoderamiento');
      assert.equal(d2.canonicalName, 'Delegación Efectiva y Empoderamiento');
      assert.equal(d3.canonicalName, 'Delegación Efectiva y Empoderamiento');
    });

    it('NO debe fusionar habilidades que representen capacidades diferentes (distintos clusters)', () => {
      const skills = [
        'Comunicación asertiva',
        'Resolución de conflictos',
        'Inteligencia emocional',
      ];
      const result = normalizeExistingSessionSkills(skills);

      assert.equal(result.length, 3);
      assert.ok(result.includes('Comunicación Asertiva y Firmeza Empática'));
      assert.ok(result.includes('Resolución Constructiva de Conflictos'));
      assert.ok(result.includes('Inteligencia y Regulación Emocional'));
    });
  });

  // =========================================================================
  // CRITERIO 3: Eliminación de cadenas vacías, ruido y términos genéricos
  // =========================================================================
  describe('Criterio 3: Descarte de ruido, vacíos y términos genéricos', () => {
    it('debe descartar cadenas vacías, espacios en blanco y longitud menor a 3 caracteres', () => {
      assert.equal(mapToCanonicalSkill(''), null);
      assert.equal(mapToCanonicalSkill('   '), null);
      assert.equal(mapToCanonicalSkill('ab'), null);
      assert.equal(mapToCanonicalSkill(' x '), null);
    });

    it('debe descartar marcadores genéricos y placeholders de plantillas', () => {
      assert.equal(mapToCanonicalSkill('ninguna'), null);
      assert.equal(mapToCanonicalSkill('n/a'), null);
      assert.equal(mapToCanonicalSkill('N/A'), null);
      assert.equal(mapToCanonicalSkill('habilidad 1'), null);
      assert.equal(mapToCanonicalSkill('habilidad 2'), null);
      assert.equal(mapToCanonicalSkill('habilidad'), null);
      assert.equal(mapToCanonicalSkill('habilidades'), null);
    });

    it('debe filtrar arreglos que contengan ruido y devolver únicamente habilidades legítimas', () => {
      const raw = ['', '   ', 'habilidad 1', 'asertividad', 'n/a', 'ninguna', 'escucha activa'];
      const result = normalizeExistingSessionSkills(raw);

      assert.equal(result.length, 2);
      assert.deepEqual(result, [
        'Comunicación Asertiva y Firmeza Empática',
        'Escucha Activa e Indagación',
      ]);
    });
  });

  // =========================================================================
  // CRITERIO 4: Restricción de fuentes de evidencia a las etapas 2, 3 y 4
  // =========================================================================
  describe('Criterio 4: Restricción de evidencia exclusiva a Etapas 2, 3 y 4', () => {
    it('debe reconocer únicamente las etapas 2, 3 y 4 en SKILL_EVIDENCE_STAGES', () => {
      assert.equal(SKILL_EVIDENCE_STAGES.has(2), true);
      assert.equal(SKILL_EVIDENCE_STAGES.has(3), true);
      assert.equal(SKILL_EVIDENCE_STAGES.has(4), true);

      assert.equal(SKILL_EVIDENCE_STAGES.has(1), false);
      assert.equal(SKILL_EVIDENCE_STAGES.has(5), false);
      assert.equal(SKILL_EVIDENCE_STAGES.has(6), false);
      assert.equal(SKILL_EVIDENCE_STAGES.has(7), false);
    });

    it('en Etapa 2 debe procesar e incorporar las habilidades preliminares evidenciadas', () => {
      const result = consolidateSkills([], ['asertividad', 'dar feedback'], 2);
      assert.equal(result.length, 2);
      assert.ok(result.includes('Comunicación Asertiva y Firmeza Empática'));
      assert.ok(result.includes('Retroalimentación Basada en Hechos'));
    });

    it('en Etapa 3 debe procesar e incorporar habilidades sustentadas por el diseño de opciones', () => {
      const existing = ['Comunicación Asertiva y Firmeza Empática'];
      const result = consolidateSkills(existing, ['escucha activa'], 3);
      assert.equal(result.length, 2);
      assert.ok(result.includes('Comunicación Asertiva y Firmeza Empática'));
      assert.ok(result.includes('Escucha Activa e Indagación'));
    });

    it('en Etapa 4 debe incorporar habilidades evidenciadas durante la simulación o práctica', () => {
      const existing = ['Comunicación Asertiva y Firmeza Empática'];
      const result = consolidateSkills(existing, ['manejo de estres y calma bajo presion'], 4);
      assert.equal(result.length, 2);
      assert.ok(result.includes('Comunicación Asertiva y Firmeza Empática'));
      assert.ok(result.includes('Inteligencia y Regulación Emocional'));
    });
  });

  // =========================================================================
  // CRITERIO 5: Conservación de habilidades cuando se omite la etapa 4
  // =========================================================================
  describe('Criterio 5: Conservación de habilidades al omitir la Etapa 4', () => {
    it('debe mantener intactas las habilidades previas si en Etapa 4 no se reciben nuevas habilidades (práctica omitida)', () => {
      const existing = [
        'Comunicación Asertiva y Firmeza Empática',
        'Gestión y Clarificación de Acuerdos',
      ];
      const result = consolidateSkills(existing, [], 4);
      assert.deepEqual(result, existing);
    });

    it('debe mantener intactas las habilidades si el líder pasa directamente de Etapa 3 a Etapa 5', () => {
      const existing = [
        'Comunicación Asertiva y Firmeza Empática',
        'Delegación Efectiva y Empoderamiento',
      ];
      const result = consolidateSkills(existing, ['nueva habilidad espuria'], 5);
      assert.deepEqual(result, existing);
    });
  });

  // =========================================================================
  // CRITERIO 6: Consolidación de nuevas evidencias sin generar duplicados
  // =========================================================================
  describe('Criterio 6: Integración incremental de evidencia sin duplicados', () => {
    it('si en Etapa 3 se reitera una habilidad ya identificada con distinta redacción, no genera duplicado', () => {
      const existing = ['Comunicación Asertiva y Firmeza Empática'];
      const incoming = ['asertividad', 'firmeza empatica', 'resolucion de conflictos'];
      const result = consolidateSkills(existing, incoming, 3);

      assert.equal(result.length, 2);
      assert.deepEqual(result, [
        'Comunicación Asertiva y Firmeza Empática',
        'Resolución Constructiva de Conflictos',
      ]);
    });

    it('si en Etapa 4 se aportan evidencias adicionales para un cluster ya existente, conserva la canónica', () => {
      const existing = [
        'Comunicación Asertiva y Firmeza Empática',
        'Escucha Activa e Indagación',
      ];
      const incoming = ['escucha empatica', 'atencion al equipo'];
      const result = consolidateSkills(existing, incoming, 4);

      assert.equal(result.length, 2);
      assert.deepEqual(result, existing);
    });
  });

  // =========================================================================
  // CRITERIO 7: Eliminación del límite rígido y conservación de 4 o más habilidades
  // =========================================================================
  describe('Criterio 7: Eliminación del límite rígido (4 o más habilidades distintas)', () => {
    it('debe conservar 4 o más habilidades distintas cuando la evidencia real las respalda', () => {
      const skills = [
        'Comunicación Asertiva y Firmeza Empática',
        'Delegación Efectiva y Empoderamiento',
        'Inteligencia y Regulación Emocional',
        'Resolución Constructiva de Conflictos',
      ];
      const result = consolidateSkills([], skills, 2);

      assert.equal(result.length, 4);
      assert.ok(result.includes('Comunicación Asertiva y Firmeza Empática'));
      assert.ok(result.includes('Delegación Efectiva y Empoderamiento'));
      assert.ok(result.includes('Inteligencia y Regulación Emocional'));
      assert.ok(result.includes('Resolución Constructiva de Conflictos'));
    });

    it('normalizeExistingSessionSkills debe conservar sesiones históricas con más de 3 habilidades', () => {
      const legacySessionSkills = [
        'comunicacion asertiva',
        'resolucion de conflictos',
        'delegacion efectiva',
        'inteligencia emocional',
        'gestion de acuerdos',
      ];
      const normalized = normalizeExistingSessionSkills(legacySessionSkills);

      assert.equal(normalized.length, 5);
      assert.ok(normalized.includes('Comunicación Asertiva y Firmeza Empática'));
      assert.ok(normalized.includes('Resolución Constructiva de Conflictos'));
      assert.ok(normalized.includes('Delegación Efectiva y Empoderamiento'));
      assert.ok(normalized.includes('Inteligencia y Regulación Emocional'));
      assert.ok(normalized.includes('Gestión y Clarificación de Acuerdos'));
    });
  });

  // =========================================================================
  // CRITERIO 8: Reconsideración de habilidades (Descarte y Sustitución Justificados)
  // =========================================================================
  describe('Criterio 8: Reconsideración de habilidades basada en evidencia (Etapas 3 y 4)', () => {
    it('debe ejecutar un descarte justificado cuando se provee evidencia explícita en Etapa 3', () => {
      const existing = [
        'Comunicación Asertiva y Firmeza Empática',
        'Resolución Constructiva de Conflictos',
      ];
      const directive: SkillReconsiderationDirective = {
        discard: [
          {
            skill: 'Resolución Constructiva de Conflictos',
            evidence: 'En la Etapa 3 se verificó que la fricción es producto de un desajuste salarial corporativo fuera del control del líder, no de un conflicto interpersonal.',
          },
        ],
      };

      const result = consolidateSkills(existing, [], 3, directive);
      assert.equal(result.length, 1);
      assert.deepEqual(result, ['Comunicación Asertiva y Firmeza Empática']);
    });

    it('debe ejecutar una sustitución justificada cuando la profundización revela una causa raíz más precisa en Etapa 3', () => {
      const existing = ['Comunicación Asertiva y Firmeza Empática'];
      const directive: SkillReconsiderationDirective = {
        replace: [
          {
            from: 'Comunicación Asertiva y Firmeza Empática',
            to: 'Gestión y Clarificación de Acuerdos',
            evidence: 'El líder comunica claramente las expectativas, pero la causa raíz es la ausencia de un acuerdo escrito con fechas compromiso y seguimiento.',
          },
        ],
      };

      const result = consolidateSkills(existing, [], 3, directive);
      assert.equal(result.length, 1);
      assert.deepEqual(result, ['Gestión y Clarificación de Acuerdos']);
    });

    it('debe rechazar directivas de descarte o sustitución si la evidencia está vacía o es espacio en blanco', () => {
      const existing = [
        'Comunicación Asertiva y Firmeza Empática',
        'Delegación Efectiva y Empoderamiento',
      ];
      const invalidDirective: SkillReconsiderationDirective = {
        discard: [
          {
            skill: 'Delegación Efectiva y Empoderamiento',
            evidence: '   ', // Evidencia vacía
          },
        ],
        replace: [
          {
            from: 'Comunicación Asertiva y Firmeza Empática',
            to: 'Resolución Constructiva de Conflictos',
            evidence: '', // Evidencia vacía
          },
        ],
      };

      const result = consolidateSkills(existing, [], 3, invalidDirective);
      // No debe aplicarse ningún cambio sin evidencia
      assert.equal(result.length, 2);
      assert.deepEqual(result, existing);
    });

    it('debe rechazar directivas de reconsideración si se envían en Etapa 2', () => {
      const incoming = ['Comunicación Asertiva y Firmeza Empática'];
      const directiveEtapa2: SkillReconsiderationDirective = {
        discard: [
          {
            skill: 'Comunicación Asertiva y Firmeza Empática',
            evidence: 'Intento prematuro de descarte en etapa de identificación inicial.',
          },
        ],
      };

      // En etapa 2 las reconsideraciones se ignoran por completo
      const result = consolidateSkills([], incoming, 2, directiveEtapa2);
      assert.equal(result.length, 1);
      assert.deepEqual(result, ['Comunicación Asertiva y Firmeza Empática']);
    });

    it('debe aplicar reconsideraciones válidas en Etapa 4 respaldadas por la práctica', () => {
      const existing = [
        'Comunicación Asertiva y Firmeza Empática',
        'Inteligencia y Regulación Emocional',
      ];
      const directiveEtapa4: SkillReconsiderationDirective = {
        replace: [
          {
            from: 'Inteligencia y Regulación Emocional',
            to: 'Retroalimentación Basada en Hechos',
            evidence: 'Durante la simulación de roleplay, el líder mantuvo serenidad óptima pero formuló críticas subjetivas en lugar de basarse en eventos observables (modelo SBI).',
          },
        ],
      };

      const result = consolidateSkills(existing, [], 4, directiveEtapa4);
      assert.equal(result.length, 2);
      assert.ok(result.includes('Comunicación Asertiva y Firmeza Empática'));
      assert.ok(result.includes('Retroalimentación Basada en Hechos'));
      assert.equal(result.includes('Inteligencia y Regulación Emocional'), false);
    });

    it('conserva habilidades previas por ausencia de mención (la no-mención no elimina)', () => {
      const existing = [
        'Comunicación Asertiva y Firmeza Empática',
        'Delegación Efectiva y Empoderamiento',
        'Resolución Constructiva de Conflictos',
      ];
      // En la Etapa 3 solo se aporta evidencia sobre delegación
      const incomingSoloUna = ['soltar el control y empoderar'];
      const result = consolidateSkills(existing, incomingSoloUna, 3);

      // Las otras 2 habilidades no mencionadas deben seguir vivas
      assert.equal(result.length, 3);
      assert.ok(result.includes('Comunicación Asertiva y Firmeza Empática'));
      assert.ok(result.includes('Delegación Efectiva y Empoderamiento'));
      assert.ok(result.includes('Resolución Constructiva de Conflictos'));
    });
  });

  // =========================================================================
  // CRITERIO 9: Conservación en etapas que no generan habilidades (1, 5, 6, 7)
  // =========================================================================
  describe('Criterio 9: Conservación en etapas no generativas (1, 5, 6 y 7)', () => {
    const existing = [
      'Comunicación Asertiva y Firmeza Empática',
      'Inteligencia y Regulación Emocional',
      'Delegación Efectiva y Empoderamiento',
      'Gestión y Clarificación de Acuerdos',
    ];

    it('en Etapa 1 rechaza cualquier habilidad entrante y devuelve las existentes normalizadas', () => {
      const result = consolidateSkills(existing, ['Nueva habilidad inventada en etapa 1'], 1);
      assert.deepEqual(result, existing);
    });

    it('en Etapa 5 rechaza habilidades entrantes y conserva las existentes', () => {
      const result = consolidateSkills(existing, ['Habilidad inventada en etapa 5'], 5);
      assert.deepEqual(result, existing);
    });

    it('en Etapa 6 rechaza habilidades entrantes y conserva las existentes', () => {
      const result = consolidateSkills(existing, ['Habilidad inventada en etapa 6'], 6);
      assert.deepEqual(result, existing);
    });

    it('en Etapa 7 rechaza habilidades entrantes y recupera las consolidadas de etapas previas', () => {
      const result = consolidateSkills(existing, ['Habilidad inventada en etapa 7'], 7);
      assert.deepEqual(result, existing);
    });
  });

  // =========================================================================
  // Formateo del Reporte Final de Etapa 7 con Evidencia Observable
  // =========================================================================
  describe('Reporte Final Etapa 7: formatStageTwoSkillsWithEvidence', () => {
    it('si no existen habilidades en la sesión, devuelve el mensaje obligatorio exacto de evidencia insuficiente', () => {
      const empty1 = formatStageTwoSkillsWithEvidence([]);
      assert.deepEqual(empty1, [INSUFFICIENT_EVIDENCE_MESSAGE]);

      const empty2 = formatStageTwoSkillsWithEvidence(['', '   ', 'ninguna', 'n/a']);
      assert.deepEqual(empty2, [INSUFFICIENT_EVIDENCE_MESSAGE]);
    });

    it('en sesiones legadas (strings sin evidencia previa), formula aviso transparente sin inventar catálogo', () => {
      const skills = [
        'Comunicación Asertiva y Firmeza Empática',
        'Resolución Constructiva de Conflictos',
        'Delegación Efectiva y Empoderamiento',
        'Gestión y Clarificación de Acuerdos',
      ];
      const formatted = formatStageTwoSkillsWithEvidence(skills);

      assert.equal(formatted.length, 4);
      assert.equal(
        formatted[0],
        'Comunicación Asertiva y Firmeza Empática — Habilidad previamente identificada (sin registro de evidencia textual conservado).'
      );
      assert.equal(
        formatted[1],
        'Resolución Constructiva de Conflictos — Habilidad previamente identificada (sin registro de evidencia textual conservado).'
      );
      assert.equal(
        formatted[2],
        'Delegación Efectiva y Empoderamiento — Habilidad previamente identificada (sin registro de evidencia textual conservado).'
      );
      assert.equal(
        formatted[3],
        'Gestión y Clarificación de Acuerdos — Habilidad previamente identificada (sin registro de evidencia textual conservado).'
      );
    });

    it('integra evidencias contextuales personalizadas si se pasan en evidenceRecords', () => {
      const skills = ['Delegación Efectiva y Empoderamiento'];
      const customEvidence = ['El líder asignó la bitácora al supervisor con fechas de corte semanales.'];
      const formatted = formatStageTwoSkillsWithEvidence(skills, customEvidence);

      assert.equal(
        formatted[0],
        'Delegación Efectiva y Empoderamiento — Evidencia observable: El líder asignó la bitácora al supervisor con fechas de corte semanales.'
      );
    });

    it('si se pasan cadenas ya formateadas previamente, las preserva sin distorsionarlas', () => {
      const alreadyFormatted = [
        'Delegación Efectiva y Empoderamiento — Evidencia en experiencia laboral (Etapa 2): Asignó tareas clave.',
      ];
      const formatted = formatStageTwoSkillsWithEvidence(alreadyFormatted);

      assert.equal(formatted[0], alreadyFormatted[0]);
    });
  });

  // =========================================================================
  // SUITE: Motor Central de Evidencias (consolidateSkillEntries)
  // =========================================================================
  describe('Motor Central de Evidencias (consolidateSkillEntries)', () => {
    it('acumula historial de evidencias a través de etapas 2, 3 y 4 sin límites rígidos artificiales', () => {
      // Etapa 2: Identificación inicial con evidencia observada
      const stage2Entries = consolidateSkillEntries(
        [],
        [
          {
            skill: 'Comunicación asertiva',
            evidenceText: 'El líder relató que evitó llamar la atención al supervisor para evitar fricciones.',
            sourceType: 'experiencia_relatada',
          },
        ],
        2,
        undefined,
        '2026-11-19T10:00:00Z'
      );

      assert.equal(stage2Entries.length, 1);
      assert.equal(stage2Entries[0].skill, 'Comunicación Asertiva y Firmeza Empática');
      assert.equal(stage2Entries[0].evidenceHistory.length, 1);
      assert.equal(stage2Entries[0].evidenceHistory[0].stage, 2);
      assert.equal(stage2Entries[0].evidenceHistory[0].sourceType, 'experiencia_relatada');

      // Etapa 3: Profundización con nueva evidencia de experiencia laboral
      const stage3Entries = consolidateSkillEntries(
        stage2Entries,
        [
          {
            skill: 'comunicacion asertiva',
            evidenceText: 'En el análisis de alternativas reconoció que cuando posterga el tema, la tensión aumenta.',
            sourceType: 'experiencia_relatada',
          },
        ],
        3,
        undefined,
        '2026-11-19T10:15:00Z'
      );

      assert.equal(stage3Entries.length, 1);
      assert.equal(stage3Entries[0].evidenceHistory.length, 2);
      assert.equal(stage3Entries[0].evidenceHistory[1].stage, 3);
      assert.equal(stage3Entries[0].evidenceHistory[1].sourceType, 'experiencia_relatada');

      // Etapa 4: Práctica simulada (evidencia 3)
      const stage4EntriesA = consolidateSkillEntries(
        stage3Entries,
        [
          {
            skill: 'comunicacion asertiva',
            evidenceText: 'Durante la simulación de roleplay, inició con rodeos pero logró formular la petición clara.',
            sourceType: 'simulacion_practica',
          },
        ],
        4,
        undefined,
        '2026-11-19T10:30:00Z'
      );

      assert.equal(stage4EntriesA.length, 1);
      assert.equal(stage4EntriesA[0].evidenceHistory.length, 3);
      assert.equal(stage4EntriesA[0].evidenceHistory[2].stage, 4);
      assert.equal(stage4EntriesA[0].evidenceHistory[2].sourceType, 'simulacion_practica');

      // Etapa 4: Segunda simulación o evidencia adicional (evidencia 4 - verificando que NO hay límite de 3)
      const stage4EntriesB = consolidateSkillEntries(
        stage4EntriesA,
        [
          {
            skill: 'comunicacion asertiva',
            evidenceText: 'En la segunda iteración de simulación, mantuvo una postura firme y empática sin titubear.',
            sourceType: 'simulacion_practica',
          },
        ],
        4,
        undefined,
        '2026-11-19T10:45:00Z'
      );

      assert.equal(stage4EntriesB.length, 1);
      // El historial conserva las 4 evidencias sin recortar artificialmente a 3
      assert.equal(stage4EntriesB[0].evidenceHistory.length, 4);
      assert.equal(stage4EntriesB[0].evidenceHistory[0].sourceType, 'experiencia_relatada');
      assert.equal(stage4EntriesB[0].evidenceHistory[1].sourceType, 'experiencia_relatada');
      assert.equal(stage4EntriesB[0].evidenceHistory[2].sourceType, 'simulacion_practica');
      assert.equal(stage4EntriesB[0].evidenceHistory[3].sourceType, 'simulacion_practica');
    });

    it('distingue rigurosamente entre experiencia_relatada y simulacion_practica', () => {
      const recRelatada: ObservedEvidenceRecord = {
        id: 'ev-1',
        stage: 2,
        sourceType: 'experiencia_relatada',
        evidenceText: 'Relató que en la junta semanal prefirió guardar silencio ante la interrupción.',
        timestamp: '2026-11-19T10:00:00Z',
      };
      const recSimulada: ObservedEvidenceRecord = {
        id: 'ev-2',
        stage: 4,
        sourceType: 'simulacion_practica',
        evidenceText: 'En el ensayo verbal respondió con claridad ante la objeción del interlocutor.',
        timestamp: '2026-11-19T10:30:00Z',
      };

      const formattedRelatada = formatEvidenceRecord(recRelatada);
      const formattedSimulada = formatEvidenceRecord(recSimulada);

      assert.equal(
        formattedRelatada,
        'Evidencia en experiencia laboral (Etapa 2): Relató que en la junta semanal prefirió guardar silencio ante la interrupción.'
      );
      assert.equal(
        formattedSimulada,
        'Evidencia en simulación (Etapa 4): En el ensayo verbal respondió con claridad ante la objeción del interlocutor.'
      );
      // La conducta simulada nunca se presenta como hecho ocurrido en el entorno laboral
      assert.ok(!formattedSimulada.includes('experiencia laboral'));
    });

    it('valida estrictamente la correspondencia entre etapa y sourceType sin permitir sobreescritura externa', () => {
      // 1. Etapa 2 con sourceType: simulacion_practica enviado por el modelo: debe quedar experiencia_relatada
      const stage2 = consolidateSkillEntries(
        [],
        [
          {
            skill: 'Comunicación asertiva',
            evidenceText: 'Evidencia etapa 2',
            sourceType: 'simulacion_practica', // Intento erróneo de simulación en Etapa 2
          },
        ],
        2
      );
      assert.equal(stage2[0].evidenceHistory[0].sourceType, 'experiencia_relatada');
      assert.equal(stage2[0].evidenceHistory[0].stage, 2);

      // 2. Etapa 3 con sourceType: simulacion_practica: debe quedar experiencia_relatada
      const stage3 = consolidateSkillEntries(
        stage2,
        [
          {
            skill: 'Comunicación asertiva',
            evidenceText: 'Evidencia etapa 3',
            sourceType: 'simulacion_practica', // Intento erróneo de simulación en Etapa 3
          },
        ],
        3
      );
      assert.equal(stage3[0].evidenceHistory[1].sourceType, 'experiencia_relatada');
      assert.equal(stage3[0].evidenceHistory[1].stage, 3);

      // 3. Etapa 4 con sourceType: experiencia_relatada: debe quedar simulacion_practica
      const stage4A = consolidateSkillEntries(
        stage3,
        [
          {
            skill: 'Comunicación asertiva',
            evidenceText: 'Evidencia etapa 4 primer ensayo',
            sourceType: 'experiencia_relatada', // Intento erróneo de experiencia laboral en Etapa 4
          },
        ],
        4
      );
      assert.equal(stage4A[0].evidenceHistory[2].sourceType, 'simulacion_practica');
      assert.equal(stage4A[0].evidenceHistory[2].stage, 4);

      // 4. Etapa 4 sin sourceType: debe quedar simulacion_practica
      const stage4B = consolidateSkillEntries(
        stage4A,
        [
          {
            skill: 'Comunicación asertiva',
            evidenceText: 'Evidencia etapa 4 segundo ensayo sin sourceType',
          },
        ],
        4
      );
      assert.equal(stage4B[0].evidenceHistory[3].sourceType, 'simulacion_practica');
      assert.equal(stage4B[0].evidenceHistory[3].stage, 4);

      // 5. Confirmar que las evidencias anteriores conservan su clasificación y no se alteran al acumular nuevas evidencias
      assert.equal(stage4B[0].evidenceHistory.length, 4);
      assert.equal(stage4B[0].evidenceHistory[0].sourceType, 'experiencia_relatada');
      assert.equal(stage4B[0].evidenceHistory[0].stage, 2);
      assert.equal(stage4B[0].evidenceHistory[1].sourceType, 'experiencia_relatada');
      assert.equal(stage4B[0].evidenceHistory[1].stage, 3);
      assert.equal(stage4B[0].evidenceHistory[2].sourceType, 'simulacion_practica');
      assert.equal(stage4B[0].evidenceHistory[2].stage, 4);
      assert.equal(stage4B[0].evidenceHistory[3].sourceType, 'simulacion_practica');
      assert.equal(stage4B[0].evidenceHistory[3].stage, 4);
    });

    it('mantiene separación estricta entre observedEvidence y reconsiderationReason', () => {
      const initialEntries = consolidateSkillEntries(
        [],
        [
          {
            skill: 'Resolución de conflictos',
            evidenceText: 'El líder describió desacuerdos recurrentes con el área de compras.',
            sourceType: 'experiencia_relatada',
          },
        ],
        2
      );

      assert.equal(initialEntries.length, 1);
      assert.equal(initialEntries[0].status, 'vigente');
      assert.equal(initialEntries[0].evidenceHistory.length, 1);

      // Descarte en Etapa 3 con razón técnica
      const updatedEntries = consolidateSkillEntries(
        initialEntries,
        [],
        3,
        {
          discard: [
            {
              skill: 'Resolución Constructiva de Conflictos',
              evidence: 'Se verificó en etapa 3 que la fricción deriva de un bloqueo presupuestal ajeno al líder.',
            },
          ],
        },
        '2026-11-19T11:00:00Z'
      );

      assert.equal(updatedEntries.length, 1);
      const discardedEntry = updatedEntries[0];

      // El estatus cambia a 'descartada'
      assert.equal(discardedEntry.status, 'descartada');

      // reconsiderationHistory contiene la justificación técnica
      assert.ok(discardedEntry.reconsiderationHistory);
      assert.equal(discardedEntry.reconsiderationHistory.length, 1);
      assert.equal(
        discardedEntry.reconsiderationHistory[0].reconsiderationReason,
        'Se verificó en etapa 3 que la fricción deriva de un bloqueo presupuestal ajeno al líder.'
      );

      // observedEvidence mantiene únicamente la conducta observada, sin mezclar con la justificación
      assert.equal(discardedEntry.evidenceHistory.length, 1);
      assert.equal(
        discardedEntry.evidenceHistory[0].evidenceText,
        'El líder describió desacuerdos recurrentes con el área de compras.'
      );

      // getActiveSkillNames excluye la descartada
      assert.deepEqual(getActiveSkillNames(updatedEntries), []);
    });

    it('bloquea la reaparición de habilidades descartadas ante menciones casuales posteriores', () => {
      // 1. Crear sesión en etapa 2 con 2 habilidades
      const stage2 = consolidateSkillEntries(
        [],
        [
          { skill: 'Comunicación asertiva', evidenceText: 'Evidencia asertividad' },
          { skill: 'Resolución de conflictos', evidenceText: 'Evidencia conflicto' },
        ],
        2
      );
      assert.equal(getActiveSkillNames(stage2).length, 2);

      // 2. Descartar resolución de conflictos en etapa 3
      const stage3 = consolidateSkillEntries(
        stage2,
        [],
        3,
        {
          discard: [
            {
              skill: 'Resolución Constructiva de Conflictos',
              evidence: 'Problema estructural de procesos, no falta de habilidad de mediación.',
            },
          ],
        }
      );
      assert.equal(getActiveSkillNames(stage3).length, 1);
      assert.deepEqual(getActiveSkillNames(stage3), ['Comunicación Asertiva y Firmeza Empática']);

      // 3. En etapa 4, el modelo devuelve casualmente 'Resolución de conflictos' como candidato
      const stage4 = consolidateSkillEntries(
        stage3,
        [
          { skill: 'Resolución de conflictos', evidenceText: 'Mención accidental en simulación' },
          { skill: 'Escucha activa', evidenceText: 'Evidencia genuina de escucha' },
        ],
        4
      );

      // Resolución de conflictos NO debe resucitar
      const activeNames = getActiveSkillNames(stage4);
      assert.equal(activeNames.includes('Resolución Constructiva de Conflictos'), false);
      assert.ok(activeNames.includes('Comunicación Asertiva y Firmeza Empática'));
      assert.ok(activeNames.includes('Escucha Activa e Indagación'));
      assert.equal(activeNames.length, 2);

      // La entrada descartada sigue existiendo en el historial con status 'descartada'
      const discardedEntry = stage4.find((e) => e.cluster === 'conflicto');
      assert.ok(discardedEntry);
      assert.equal(discardedEntry.status, 'descartada');
    });

    it('bloquea la reaparición de habilidades sustituidas ante menciones casuales posteriores', () => {
      // Etapa 2: Inteligencia emocional identificada
      const stage2 = consolidateSkillEntries(
        [],
        [{ skill: 'Inteligencia emocional', evidenceText: 'El líder mostró tensión ante reclamos.' }],
        2
      );

      // Etapa 3: Sustituir Inteligencia Emocional por Retroalimentación Basada en Hechos
      const stage3 = consolidateSkillEntries(
        stage2,
        [],
        3,
        {
          replace: [
            {
              from: 'Inteligencia y Regulación Emocional',
              to: 'Retroalimentación Basada en Hechos',
              evidence: 'El líder maneja su templanza pero emite juicios subjetivos sin hechos concretos.',
            },
          ],
        }
      );

      assert.deepEqual(getActiveSkillNames(stage3), ['Retroalimentación Basada en Hechos']);

      // Etapa 4: Reintento casual de ingresar Inteligencia Emocional
      const stage4 = consolidateSkillEntries(
        stage3,
        [{ skill: 'Inteligencia emocional', evidenceText: 'Mención casual' }],
        4
      );

      // Inteligencia emocional NO debe reactivarse
      assert.deepEqual(getActiveSkillNames(stage4), ['Retroalimentación Basada en Hechos']);
      const fromEntry = stage4.find((e) => e.cluster === 'emocional');
      assert.ok(fromEntry);
      assert.equal(fromEntry.status, 'sustituida');
    });

    it('las etapas no generativas (1, 5, 6 y 7) no modifican ni agregan entradas', () => {
      const existingEntries = consolidateSkillEntries(
        [],
        [{ skill: 'Comunicación asertiva', evidenceText: 'Evidencia inicial' }],
        2
      );

      // En Etapa 1
      const stage1 = consolidateSkillEntries(
        existingEntries,
        [{ skill: 'Habilidad intrusa etapa 1', evidenceText: 'Ruido' }],
        1
      );
      assert.equal(stage1.length, 1);
      assert.equal(stage1[0].skill, 'Comunicación Asertiva y Firmeza Empática');

      // En Etapa 5
      const stage5 = consolidateSkillEntries(
        existingEntries,
        [{ skill: 'Habilidad intrusa etapa 5', evidenceText: 'Ruido' }],
        5
      );
      assert.equal(stage5.length, 1);
      assert.equal(stage5[0].skill, 'Comunicación Asertiva y Firmeza Empática');

      // En Etapa 6
      const stage6 = consolidateSkillEntries(
        existingEntries,
        [{ skill: 'Habilidad intrusa etapa 6', evidenceText: 'Ruido' }],
        6
      );
      assert.equal(stage6.length, 1);
      assert.equal(stage6[0].skill, 'Comunicación Asertiva y Firmeza Empática');

      // En Etapa 7
      const stage7 = consolidateSkillEntries(
        existingEntries,
        [{ skill: 'Habilidad intrusa etapa 7', evidenceText: 'Ruido' }],
        7
      );
      assert.equal(stage7.length, 1);
      assert.equal(stage7[0].skill, 'Comunicación Asertiva y Firmeza Empática');
    });

    it('formatea entradas estructuradas para el Reporte Final de Etapa 7', () => {
      const entries: LeadershipSkillEntry[] = [
        {
          skill: 'Comunicación Asertiva y Firmeza Empática',
          cluster: 'comunicacion',
          status: 'vigente',
          initialStage: 2,
          evidenceHistory: [
            {
              id: 'ev-1',
              stage: 2,
              sourceType: 'experiencia_relatada',
              evidenceText: 'Describió retraso en entregas por no hablar directamente con el supervisor.',
              timestamp: '2026-11-19T10:00:00Z',
            },
            {
              id: 'ev-2',
              stage: 4,
              sourceType: 'simulacion_practica',
              evidenceText: 'En el ensayo verbal logró exponer con claridad los acuerdos esperados.',
              timestamp: '2026-11-19T10:30:00Z',
            },
          ],
          lastUpdatedStage: 4,
          createdAt: '2026-11-19T10:00:00Z',
          updatedAt: '2026-11-19T10:30:00Z',
        },
      ];

      const formatted = formatStageTwoSkillsWithEvidence(entries);
      assert.equal(formatted.length, 1);
      assert.equal(
        formatted[0],
        'Comunicación Asertiva y Firmeza Empática — Evidencia en experiencia laboral (Etapa 2): Describió retraso en entregas por no hablar directamente con el supervisor. | Evidencia en simulación (Etapa 4): En el ensayo verbal logró exponer con claridad los acuerdos esperados.'
      );
    });

    it('si todas las entradas están descartadas, devuelve el mensaje de evidencia insuficiente', () => {
      const discardedEntries: LeadershipSkillEntry[] = [
        {
          skill: 'Resolución Constructiva de Conflictos',
          cluster: 'conflicto',
          status: 'descartada',
          initialStage: 2,
          evidenceHistory: [],
          reconsiderationHistory: [
            {
              stage: 3,
              reconsiderationReason: 'Descarte confirmado por causa estructural ajena.',
              timestamp: '2026-11-19T10:00:00Z',
            },
          ],
          lastUpdatedStage: 3,
          createdAt: '2026-11-19T09:00:00Z',
          updatedAt: '2026-11-19T10:00:00Z',
        },
      ];

      const formatted = formatStageTwoSkillsWithEvidence(discardedEntries);
      assert.deepEqual(formatted, [INSUFFICIENT_EVIDENCE_MESSAGE]);
    });

    it('mantiene retrocompatibilidad y consistencia con llamadas legadas a consolidateSkills', () => {
      const existing = ['Comunicación Asertiva y Firmeza Empática'];
      const incoming = ['resolucion de conflictos'];
      const consolidated = consolidateSkills(existing, incoming, 3);

      assert.equal(consolidated.length, 2);
      assert.ok(consolidated.includes('Comunicación Asertiva y Firmeza Empática'));
      assert.ok(consolidated.includes('Resolución Constructiva de Conflictos'));
    });
  });
});

