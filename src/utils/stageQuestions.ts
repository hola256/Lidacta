import { StageNumber } from '../types/lidacta';

export const getStageTriggerQuestion = (
  st: StageNumber,
  mentorship: { id?: string; title?: string; theme?: string; identifiedSkills?: string[] },
  leaderName?: string
): string => {
  const leaderFirstName = leaderName ? leaderName.split(' ')[0] : 'Líder';
  const skillsList =
    mentorship.identifiedSkills && mentorship.identifiedSkills.length > 0
      ? mentorship.identifiedSkills.join(' y ')
      : '';

  switch (st) {
    case 1:
      return `Hola ${leaderFirstName}. Para detectar qué sucede y comprender mejor la situación que estás enfrentando, sin juicios ni suposiciones: ¿Cuál es el hecho o detonante principal que ocurrió y quiénes están directamente involucrados?`;
    case 2:
      return `En la etapa anterior comprendimos los hechos iniciales sobre "${mentorship.title || 'el reto'}". En esta Etapa 2 (Analizar perspectivas y habilidades): explora cómo estás viviendo la situación y qué necesitas poner en juego como líder. ¿Cómo crees que perciben la situación los demás involucrados y qué habilidades de liderazgo te ayudarían a abordar el reto?`;
    case 3:
      if (mentorship.id === 'ment_roberto_2' || mentorship.theme?.toLowerCase().includes('delegación')) {
        return `En la etapa anterior definimos la delegación y el empoderamiento; para avanzar en esta Etapa 3 (Diseñar alternativas) y encontrar el camino que mejor se adapte a tu realidad, ¿qué tarea específica te cuesta más trabajo entregar hoy y qué alternativas viables visualizas para actuar?`;
      }
      if (skillsList) {
        return `En la etapa anterior definimos la necesidad de trabajar en ${skillsList}; para avanzar en esta Etapa 3 (Diseñar alternativas) y encontrar el camino que mejor se adapte a tu realidad, ¿qué alternativas viables construyes para elegir cómo quieres actuar?`;
      }
      return `En la etapa anterior analizamos las perspectivas y habilidades requeridas; para avanzar en esta Etapa 3 (Diseñar alternativas): explora distintas formas de abordar la situación y encuentra el camino que mejor se adapte a tu realidad. ¿Qué alternativas viables visualizas para actuar?`;
    case 4:
      return `Tú has diseñado las alternativas clave. En esta Etapa 4 (Practicar antes de actuar): prepárate para afrontar la situación practicando una conversación o escenario real en un espacio seguro antes de llevarlo a la práctica. ¿Qué diálogo, objeción o postura difícil te gustaría ensayar conmigo?`;
    case 5:
      return `Con las alternativas y la preparación listas, entramos a la Etapa 5 (Actuar - Plan de Acción): convierte lo que has trabajado en una acción concreta que puedas llevar a la práctica. ¿Qué harás exactamente, cuándo y con quién para avanzar en la situación?`;
    case 6:
      return `Tras poner en práctica tu decisión, entramos a la Etapa 6 (Aprender y reflexionar): revisa lo que sucedió al poner en práctica tu decisión y descubre qué puedes aprender de la experiencia. ¿Qué funcionó, qué puedes ajustar y qué te llevas para futuros retos?`;
    case 7:
      return `Has completado el ciclo del acompañamiento. En esta Etapa 7 (Cierre y retroalimentación): integra tus avances y reconoce las habilidades que has puesto en práctica. A continuación tienes tu reporte consolidado para seguir desarrollándote como líder.`;
    default:
      return `Apertura de la Etapa ${st}: Comparte tus reflexiones o dudas para avanzar en tu acompañamiento directivo.`;
  }
};
