import { getApiBaseUrl } from '../utils/apiConfig';
import { authService } from './auth';
import type { ShowIfRule } from '../utils/questionnaireVisibility';

export type { ShowIfRule, ShowIfCondition, ShowIfLogic, ShowIfOperator } from '../utils/questionnaireVisibility';

export type AnswerType =
  | 'boolean'
  | 'text'
  | 'number'
  | 'single_choice'
  | 'multiple_choice'
  | 'scale'
  | 'date';

export type QuestionnaireScope = 'day' | 'position';

export interface QuestionChoice {
  id?: number;
  label: string;
  order: number;
}

export interface QuestionTemplate {
  id: number;
  label: string;
  help_text: string;
  answer_type: AnswerType;
  config: Record<string, unknown>;
  is_active: boolean;
  choices: QuestionChoice[];
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireQuestion {
  id: number;
  questionnaire: number;
  source_template: number | null;
  label: string;
  help_text: string;
  answer_type: AnswerType;
  config: Record<string, unknown>;
  required: boolean;
  order: number;
  is_active: boolean;
  show_if?: ShowIfRule | null;
  choices: QuestionChoice[];
  created_at: string;
  updated_at: string;
}

export interface Questionnaire {
  id: number;
  scope: QuestionnaireScope;
  name: string;
  is_active: boolean;
  questions: QuestionnaireQuestion[];
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireAnswer {
  id: number;
  question_id: number;
  value: unknown;
  question_label_snapshot: string;
  answer_type_snapshot: string;
  trading_account: number | null;
  date: string | null;
  trade: number | null;
  created_at: string;
  updated_at: string;
}

export interface AnswersFormPayload {
  scope: QuestionnaireScope;
  questionnaire_id: number | null;
  questions: QuestionnaireQuestion[];
  answers: QuestionnaireAnswer[];
}

export interface BulkAnswersPayload {
  scope: QuestionnaireScope;
  date?: string | null;
  trading_account?: number | null;
  trade?: number | null;
  answers: Array<{ question_id: number; value: unknown }>;
}

class JournalQuestionsService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    } as Record<string, string>;
  }

  private async refreshAccessToken(): Promise<boolean> {
    const access = await authService.refreshAccessToken();
    return !!access;
  }

  private async fetchWithAuth(input: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> || {}),
      ...this.getAuthHeaders(),
    };
    if (init.body instanceof FormData) {
      delete headers['Content-Type'];
    }
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401 && retry) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.fetchWithAuth(input, init, false);
      }
    }
    return res;
  }

  private async parseError(res: Response): Promise<string> {
    try {
      const data = await res.json();
      if (typeof data === 'string') return data;
      if (data.detail) return String(data.detail);
      const firstKey = Object.keys(data)[0];
      if (firstKey) {
        const val = data[firstKey];
        if (Array.isArray(val)) return `${firstKey}: ${val[0]}`;
        if (typeof val === 'string') return val;
      }
      return JSON.stringify(data);
    } catch {
      return res.statusText || 'Erreur';
    }
  }

  // --- Templates ---
  async listTemplates(isActive?: boolean): Promise<QuestionTemplate[]> {
    const params = new URLSearchParams();
    if (isActive !== undefined) params.set('is_active', String(isActive));
    const q = params.toString();
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/daily-journal/question-templates/${q ? `?${q}` : ''}`
    );
    if (!res.ok) throw new Error(await this.parseError(res));
    const data = await res.json();
    return Array.isArray(data) ? data : data.results || [];
  }

  async createTemplate(payload: Partial<QuestionTemplate> & { label: string; answer_type: AnswerType }): Promise<QuestionTemplate> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/question-templates/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await this.parseError(res));
    return res.json();
  }

  async updateTemplate(id: number, payload: Partial<QuestionTemplate>): Promise<QuestionTemplate> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/question-templates/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await this.parseError(res));
    return res.json();
  }

  async deleteTemplate(id: number): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/question-templates/${id}/`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await this.parseError(res));
  }

  // --- Questionnaires ---
  async getOrCreateQuestionnaire(scope: QuestionnaireScope): Promise<Questionnaire> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/questionnaires/`, {
      method: 'POST',
      body: JSON.stringify({ scope }),
    });
    if (!res.ok) throw new Error(await this.parseError(res));
    return res.json();
  }

  async listQuestionnaireQuestions(questionnaireId: number, isActive?: boolean): Promise<QuestionnaireQuestion[]> {
    const params = new URLSearchParams();
    if (isActive !== undefined) params.set('is_active', String(isActive));
    const q = params.toString();
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/daily-journal/questionnaires/${questionnaireId}/questions/${q ? `?${q}` : ''}`
    );
    if (!res.ok) throw new Error(await this.parseError(res));
    return res.json();
  }

  async createQuestion(
    questionnaireId: number,
    payload: Partial<QuestionnaireQuestion> & { label: string; answer_type: AnswerType }
  ): Promise<QuestionnaireQuestion> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/daily-journal/questionnaires/${questionnaireId}/questions/`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
    if (!res.ok) throw new Error(await this.parseError(res));
    return res.json();
  }

  async cloneFromTemplate(questionnaireId: number, templateId: number): Promise<QuestionnaireQuestion> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/daily-journal/questionnaires/${questionnaireId}/questions/from-template/`,
      { method: 'POST', body: JSON.stringify({ template_id: templateId }) }
    );
    if (!res.ok) throw new Error(await this.parseError(res));
    return res.json();
  }

  async reorderQuestions(questionnaireId: number, ids: number[]): Promise<QuestionnaireQuestion[]> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/daily-journal/questionnaires/${questionnaireId}/questions/reorder/`,
      { method: 'POST', body: JSON.stringify({ ids }) }
    );
    if (!res.ok) throw new Error(await this.parseError(res));
    return res.json();
  }

  async updateQuestion(id: number, payload: Partial<QuestionnaireQuestion>): Promise<QuestionnaireQuestion> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/daily-journal/questionnaire-questions/${id}/`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    );
    if (!res.ok) throw new Error(await this.parseError(res));
    return res.json();
  }

  async deleteQuestion(id: number): Promise<{ deactivated?: boolean; question?: QuestionnaireQuestion }> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/daily-journal/questionnaire-questions/${id}/`,
      { method: 'DELETE' }
    );
    if (res.status === 204) return {};
    if (!res.ok) throw new Error(await this.parseError(res));
    const data = await res.json();
    return { deactivated: true, question: data.question };
  }

  // --- Answers ---
  async getAnswers(params: {
    scope: QuestionnaireScope;
    date?: string;
    trading_account?: number | null;
    trade?: number;
  }): Promise<AnswersFormPayload> {
    const search = new URLSearchParams();
    search.set('scope', params.scope);
    if (params.date) search.set('date', params.date);
    if (params.trading_account != null) search.set('trading_account', String(params.trading_account));
    if (params.trade != null) search.set('trade', String(params.trade));
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/daily-journal/answers/?${search.toString()}`
    );
    if (!res.ok) throw new Error(await this.parseError(res));
    return res.json();
  }

  async bulkSaveAnswers(payload: BulkAnswersPayload): Promise<{ answers: QuestionnaireAnswer[] }> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/answers/bulk/`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await this.parseError(res));
    return res.json();
  }
}

export const journalQuestionsService = new JournalQuestionsService();
