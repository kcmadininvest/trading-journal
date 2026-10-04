import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JournalQuestionsForm } from './JournalQuestionsForm';
import {
  journalQuestionsService,
  type AnswerType,
  type QuestionnaireQuestion,
} from '../../services/journalQuestions';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
      i18n: { language: 'fr' },
    }),
  };
});

vi.mock('../../services/journalQuestions', () => ({
  journalQuestionsService: {
    getAnswers: vi.fn(),
    bulkSaveAnswers: vi.fn(),
  },
}));

function question(
  id: number,
  answerType: AnswerType,
  extra: Partial<QuestionnaireQuestion> = {}
): QuestionnaireQuestion {
  return {
    id,
    questionnaire: 1,
    source_template: null,
    label: answerType,
    help_text: '',
    answer_type: answerType,
    config: answerType === 'scale' ? { min: 1, max: 5, step: 1 } : {},
    required: false,
    order: id,
    is_active: true,
    show_if: null,
    choices:
      answerType === 'single_choice' || answerType === 'multiple_choice'
        ? [
            { id: id * 10 + 1, label: `Choix ${id}`, order: 0 },
            { id: id * 10 + 2, label: `Autre ${id}`, order: 1 },
          ]
        : [],
    created_at: '',
    updated_at: '',
    ...extra,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('JournalQuestionsForm empty defaults', () => {
  it('shows every unanswered question type as empty', async () => {
    vi.mocked(journalQuestionsService.getAnswers).mockResolvedValue({
      scope: 'day',
      questionnaire_id: 1,
      questions: [
        question(1, 'boolean'),
        question(2, 'text'),
        question(3, 'number'),
        question(4, 'single_choice'),
        question(5, 'multiple_choice'),
        question(6, 'scale'),
        question(7, 'date'),
      ],
      answers: [],
    });

    render(<JournalQuestionsForm scope="day" date="2026-10-04" tradingAccountId={1} />);

    expect(await screen.findByRole('button', { name: /^selectOption$/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'clearAnswer' })).toBeNull();
    expect(screen.queryByText('Choix 4')).toBeNull();

    for (const name of ['yes', 'no', '1', '2', '3', '4', '5']) {
      expect(screen.getByRole('button', { name })).toHaveProperty('ariaPressed', 'false');
    }

    expect(screen.getByRole('button', { name: 'selectOptions' })).toBeTruthy();
    expect(screen.queryByText('Choix 5')).toBeNull();

    const textareas = screen.getAllByRole('textbox');
    expect(textareas.every((el) => (el as HTMLInputElement | HTMLTextAreaElement).value === '')).toBe(true);
  });

  it('clears a segmented answer on a second click and persists the removal', async () => {
    vi.mocked(journalQuestionsService.getAnswers).mockResolvedValue({
      scope: 'day',
      questionnaire_id: 1,
      questions: [question(1, 'boolean')],
      answers: [
        {
          id: 9,
          question_id: 1,
          value: true,
          question_label_snapshot: 'boolean',
          answer_type_snapshot: 'boolean',
          trading_account: 1,
          date: '2026-10-04',
          trade: null,
          created_at: '',
          updated_at: '',
        },
      ],
    });
    vi.mocked(journalQuestionsService.bulkSaveAnswers).mockResolvedValue({ answers: [] });

    render(<JournalQuestionsForm scope="day" date="2026-10-04" tradingAccountId={1} />);

    const yes = await screen.findByRole('button', { name: 'yes' });
    expect(yes).toHaveProperty('ariaPressed', 'true');

    fireEvent.click(yes);
    expect(yes).toHaveProperty('ariaPressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'saveAnswers' }));

    await waitFor(() => expect(journalQuestionsService.bulkSaveAnswers).toHaveBeenCalled());
    const payload = vi.mocked(journalQuestionsService.bulkSaveAnswers).mock.calls[0][0];
    expect(payload.answers).toEqual([{ question_id: 1, value: null }]);
  });

  it('shows Choisir when empty and Aucune réponse only to clear a saved choice', async () => {
    const choice = question(4, 'single_choice');
    const savedChoiceId = choice.choices[0].id as number;
    vi.mocked(journalQuestionsService.getAnswers).mockResolvedValue({
      scope: 'day',
      questionnaire_id: 1,
      questions: [choice],
      answers: [
        {
          id: 11,
          question_id: 4,
          value: savedChoiceId,
          question_label_snapshot: 'single_choice',
          answer_type_snapshot: 'single_choice',
          trading_account: 1,
          date: '2026-10-04',
          trade: null,
          created_at: '',
          updated_at: '',
        },
      ],
    });
    vi.mocked(journalQuestionsService.bulkSaveAnswers).mockResolvedValue({ answers: [] });

    render(<JournalQuestionsForm scope="day" date="2026-10-04" tradingAccountId={1} />);

    const field = await screen.findByRole('button', { name: 'Choix 4' });
    expect(screen.queryByRole('button', { name: 'clearAnswer' })).toBeNull();

    fireEvent.click(field);
    fireEvent.click(await screen.findByRole('button', { name: 'clearAnswer' }));

    expect(screen.getByRole('button', { name: /^selectOption$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'saveAnswers' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'saveAnswers' }));

    await waitFor(() => expect(journalQuestionsService.bulkSaveAnswers).toHaveBeenCalled());
    const payload = vi.mocked(journalQuestionsService.bulkSaveAnswers).mock.calls[0][0];
    expect(payload.answers).toEqual([{ question_id: 4, value: null }]);
  });
});
