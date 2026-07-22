/** Miroir front de daily_journal.conditional_visibility */

export type ShowIfOperator = 'eq' | 'neq';
export type ShowIfLogic = 'and' | 'or';

export interface ShowIfCondition {
  question_id: number;
  operator: ShowIfOperator;
  value: boolean | number;
}

export interface ShowIfRule {
  logic: ShowIfLogic;
  conditions: ShowIfCondition[];
}

export type BranchableAnswerType = 'boolean' | 'single_choice' | 'multiple_choice';

export const BRANCHABLE_TYPES = new Set<string>([
  'boolean',
  'single_choice',
  'multiple_choice',
]);

export function isBranchableType(type: string): type is BranchableAnswerType {
  return BRANCHABLE_TYPES.has(type);
}

export function normalizeShowIf(raw: ShowIfRule | null | undefined): ShowIfRule | null {
  if (!raw || !raw.conditions || raw.conditions.length === 0) return null;
  const logic: ShowIfLogic =
    raw.conditions.length === 1 ? 'and' : raw.logic === 'or' ? 'or' : 'and';
  return {
    logic,
    conditions: raw.conditions.map((c) => ({
      question_id: c.question_id,
      operator: c.operator === 'neq' ? 'neq' : 'eq',
      value: c.value,
    })),
  };
}

function conditionMatches(
  operator: ShowIfOperator,
  expected: boolean | number,
  actual: unknown,
  answerType: string
): boolean {
  let matched = false;
  if (actual === null || actual === undefined || actual === '') {
    matched = false;
  } else if (answerType === 'multiple_choice') {
    const selected = Array.isArray(actual) ? actual : [];
    matched = selected.includes(expected);
  } else {
    matched = actual === expected;
  }
  return operator === 'eq' ? matched : !matched;
}

export interface VisibilityQuestion {
  id: number;
  answer_type: string;
  show_if?: ShowIfRule | null;
}

export function isQuestionVisible(
  question: VisibilityQuestion,
  answersByQid: Record<number, unknown>,
  questionsById: Record<number, VisibilityQuestion>,
  cache: Record<number, boolean> = {}
): boolean {
  if (question.id in cache) return cache[question.id];

  const showIf = normalizeShowIf(question.show_if ?? null);
  if (!showIf) {
    cache[question.id] = true;
    return true;
  }

  cache[question.id] = false;
  const results = showIf.conditions.map((cond) => {
    const source = questionsById[cond.question_id];
    if (!source) return false;
    if (!isQuestionVisible(source, answersByQid, questionsById, cache)) return false;
    return conditionMatches(
      cond.operator,
      cond.value,
      answersByQid[cond.question_id],
      source.answer_type
    );
  });

  const visible = showIf.logic === 'or' ? results.some(Boolean) : results.every(Boolean);
  cache[question.id] = visible;
  return visible;
}

export function getAnchorQuestionId(showIf: ShowIfRule | null | undefined): number | null {
  const rule = normalizeShowIf(showIf ?? null);
  if (!rule || rule.conditions.length === 0) return null;
  return rule.conditions[0].question_id;
}

/** Ordre d'affichage Settings : racines puis dépendantes groupées sous leur ancre (DFS). */
export function sortQuestionsForDisplay<T extends VisibilityQuestion & { order: number }>(
  questions: T[]
): T[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const children = new Map<number, T[]>();
  const roots: T[] = [];

  for (const q of questions) {
    const anchor = getAnchorQuestionId(q.show_if);
    if (anchor != null && byId.has(anchor) && anchor !== q.id) {
      const list = children.get(anchor) || [];
      list.push(q);
      children.set(anchor, list);
    } else {
      roots.push(q);
    }
  }

  const sortByOrder = (a: T, b: T) => a.order - b.order || a.id - b.id;
  roots.sort(sortByOrder);
  for (const list of children.values()) list.sort(sortByOrder);

  const result: T[] = [];
  const visit = (q: T) => {
    result.push(q);
    for (const child of children.get(q.id) || []) {
      visit(child);
    }
  };
  for (const root of roots) visit(root);

  // Orphelins non visités (cycle / ancre manquante)
  for (const q of questions) {
    if (!result.includes(q)) result.push(q);
  }
  return result;
}

export function getQuestionDepth(
  question: VisibilityQuestion,
  questionsById: Record<number, VisibilityQuestion>,
  seen = new Set<number>()
): number {
  const anchor = getAnchorQuestionId(question.show_if);
  if (anchor == null || !questionsById[anchor] || seen.has(question.id)) return 0;
  seen.add(question.id);
  return 1 + getQuestionDepth(questionsById[anchor], questionsById, seen);
}
