import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayPositionAnswersSummary } from './DayPositionAnswersSummary';
import { userService } from '../../services/userService';
import type {
  DayPositionTrade,
  QuestionnaireAnswer,
  QuestionnaireQuestion,
} from '../../services/journalQuestions';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'fr' },
    }),
  };
});

const preferenceState = { journal_questions_positions_collapsed: false };

vi.mock('../../hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: {
      language: 'fr',
      timezone: 'Europe/Paris',
      date_format: 'EU',
      number_format: 'comma',
      get journal_questions_positions_collapsed() {
        return preferenceState.journal_questions_positions_collapsed;
      },
    },
    mergePreferences: (partial: { journal_questions_positions_collapsed?: boolean }) => {
      if (partial.journal_questions_positions_collapsed != null) {
        preferenceState.journal_questions_positions_collapsed = partial.journal_questions_positions_collapsed;
      }
    },
  }),
}));

vi.mock('../../services/userService', () => ({
  userService: {
    updatePreferences: vi.fn().mockResolvedValue({}),
  },
}));

function question(
  id: number,
  answerType: QuestionnaireQuestion['answer_type'],
  extra: Partial<QuestionnaireQuestion> = {}
): QuestionnaireQuestion {
  return {
    id,
    questionnaire: 1,
    source_template: null,
    label: `Q${id}`,
    help_text: '',
    answer_type: answerType,
    config: {},
    required: false,
    order: id,
    is_active: true,
    show_if: null,
    choices: [],
    created_at: '',
    updated_at: '',
    ...extra,
  };
}

function answer(questionId: number, trade: number, value: unknown): QuestionnaireAnswer {
  return {
    id: questionId * 100 + trade,
    question_id: questionId,
    value,
    question_label_snapshot: `Q${questionId}`,
    answer_type_snapshot: 'text',
    trading_account: 1,
    date: null,
    trade,
    created_at: '',
    updated_at: '',
  };
}

const trade: DayPositionTrade = {
  id: 7,
  contract_name: 'ES',
  trade_type: 'Long',
  entered_at: '2026-07-10T08:00:00Z',
};

afterEach(() => {
  cleanup();
  preferenceState.journal_questions_positions_collapsed = false;
  vi.mocked(userService.updatePreferences).mockClear();
});

describe('DayPositionAnswersSummary', () => {
  it('formats choices, yes/no, numbers and dates', () => {
    const questions = [
      question(1, 'boolean', { label: 'Reprendre ?' }),
      question(2, 'single_choice', {
        label: 'Setup',
        choices: [
          { id: 21, label: 'Cassure', order: 0 },
          { id: 22, label: 'Rejet', order: 1 },
        ],
      }),
      question(3, 'multiple_choice', {
        label: 'Zones',
        choices: [
          { id: 31, label: 'Support', order: 0 },
          { id: 32, label: 'Résistance', order: 1 },
        ],
      }),
      question(4, 'number', { label: 'R max', config: { decimal: true } }),
      question(5, 'scale', { label: 'Qualité', config: { min: 1, max: 5, step: 1 } }),
      question(6, 'date', { label: 'Revue' }),
      question(7, 'boolean', {
        label: 'Masquée',
        show_if: { logic: 'and', conditions: [{ question_id: 1, operator: 'eq', value: false }] },
      }),
    ];

    render(
      <DayPositionAnswersSummary
        questions={questions}
        trades={[trade]}
        answers={[
          answer(1, 7, true),
          answer(2, 7, 22),
          answer(3, 7, [31, 32]),
          answer(4, 7, 1.5),
          answer(5, 7, 4),
          answer(6, 7, '2026-07-02'),
          answer(7, 7, false),
        ]}
        onEdit={() => undefined}
      />
    );

    expect(screen.getByText('Reprendre ?')).toBeTruthy();
    expect(screen.getByText('yes')).toBeTruthy();
    expect(screen.getByText('Rejet')).toBeTruthy();
    expect(screen.getByText('Support, Résistance')).toBeTruthy();
    expect(screen.getByText('1,50')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('02/07/2026')).toBeTruthy();
    expect(screen.queryByText('Masquée')).toBeNull();
    expect(screen.getByText('ES')).toBeTruthy();
    expect(screen.getByText('Long')).toBeTruthy();
  });

  it('shows an empty state when the trade has no answer', () => {
    render(
      <DayPositionAnswersSummary
        questions={[question(1, 'text', { label: 'Contexte' })]}
        trades={[trade]}
        answers={[]}
        onEdit={() => undefined}
      />
    );

    expect(screen.getByText('notAnsweredYet')).toBeTruthy();
    expect(screen.queryByText('Contexte')).toBeNull();
  });

  it('hides the section when there is no trade or no active question', () => {
    const { rerender } = render(
      <DayPositionAnswersSummary
        questions={[question(1, 'text')]}
        trades={[]}
        answers={[]}
        onEdit={() => undefined}
      />
    );
    expect(screen.queryByRole('heading')).toBeNull();

    rerender(
      <DayPositionAnswersSummary
        questions={[question(1, 'text', { is_active: false })]}
        trades={[trade]}
        answers={[answer(1, 7, 'historique')]}
        onEdit={() => undefined}
      />
    );
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('remembers when the section is collapsed', async () => {
    const { unmount } = render(
      <DayPositionAnswersSummary
        questions={[question(1, 'text', { label: 'Contexte' })]}
        trades={[trade]}
        answers={[answer(1, 7, 'Hausse')]}
        onEdit={() => undefined}
      />
    );

    expect(screen.getByText('Hausse').closest('[hidden]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'positionDayTitle' }));
    expect(screen.getByRole('button', { name: 'positionDayTitle' }).getAttribute('aria-expanded')).toBe(
      'false'
    );
    expect(screen.getByText('Hausse').closest('[hidden]')).not.toBeNull();
    await waitFor(() => {
      expect(userService.updatePreferences).toHaveBeenCalledWith({
        journal_questions_positions_collapsed: true,
      });
    });

    unmount();
    render(
      <DayPositionAnswersSummary
        questions={[question(1, 'text', { label: 'Contexte' })]}
        trades={[trade]}
        answers={[answer(1, 7, 'Hausse')]}
        onEdit={() => undefined}
      />
    );
    expect(screen.getByText('Hausse').closest('[hidden]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'positionDayTitle' }));
    expect(screen.getByText('Hausse').closest('[hidden]')).toBeNull();
    await waitFor(() => {
      expect(userService.updatePreferences).toHaveBeenCalledWith({
        journal_questions_positions_collapsed: false,
      });
    });
  });

  it('calls onEdit from the edit button', () => {
    const onEdit = vi.fn();
    render(
      <DayPositionAnswersSummary
        questions={[question(1, 'boolean')]}
        trades={[trade]}
        answers={[]}
        onEdit={onEdit}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
