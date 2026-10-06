import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JournalQuestionsForm, type JournalQuestionsFormHandle } from './JournalQuestionsForm';
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

function savedAnswer(questionId: number, value: unknown, answerType: AnswerType) {
  return {
    id: questionId * 100,
    question_id: questionId,
    value,
    question_label_snapshot: answerType,
    answer_type_snapshot: answerType,
    trading_account: 1,
    date: '2026-10-04',
    trade: null,
    created_at: '',
    updated_at: '',
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

    expect(await screen.findByRole('button', { name: 'Choix 4' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^selectOptions?$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'clearAnswer' })).toBeNull();

    for (const name of ['yes', 'no', '1', '2', '3', '4', '5', 'Choix 4', 'Autre 4', 'Choix 5', 'Autre 5']) {
      expect(screen.getByRole('button', { name })).toHaveProperty('ariaPressed', 'false');
    }

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

  it('selects a single-choice pill, switches, and clears a saved choice with a second click', async () => {
    const choice = question(4, 'single_choice');
    vi.mocked(journalQuestionsService.getAnswers).mockResolvedValue({
      scope: 'day',
      questionnaire_id: 1,
      questions: [choice],
      answers: [savedAnswer(4, choice.choices[0].id, 'single_choice')],
    });
    vi.mocked(journalQuestionsService.bulkSaveAnswers).mockResolvedValue({ answers: [] });

    render(<JournalQuestionsForm scope="day" date="2026-10-04" tradingAccountId={1} />);

    const firstPill = await screen.findByRole('button', { name: 'Choix 4' });
    const secondPill = screen.getByRole('button', { name: 'Autre 4' });
    expect(firstPill).toHaveProperty('ariaPressed', 'true');

    fireEvent.click(secondPill);
    expect(firstPill).toHaveProperty('ariaPressed', 'false');
    expect(secondPill).toHaveProperty('ariaPressed', 'true');

    fireEvent.click(secondPill);
    expect(secondPill).toHaveProperty('ariaPressed', 'false');
    expect(screen.getByRole('button', { name: 'saveAnswers' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'saveAnswers' }));

    await waitFor(() => expect(journalQuestionsService.bulkSaveAnswers).toHaveBeenCalled());
    const payload = vi.mocked(journalQuestionsService.bulkSaveAnswers).mock.calls[0][0];
    expect(payload.answers).toEqual([{ question_id: 4, value: null }]);
  });

  it('toggles several multiple-choice pills without any dropdown', async () => {
    const choice = question(5, 'multiple_choice');
    const second = choice.choices[1].id;
    vi.mocked(journalQuestionsService.getAnswers).mockResolvedValue({
      scope: 'day',
      questionnaire_id: 1,
      questions: [choice],
      answers: [],
    });
    vi.mocked(journalQuestionsService.bulkSaveAnswers).mockResolvedValue({ answers: [] });

    render(<JournalQuestionsForm scope="day" date="2026-10-04" tradingAccountId={1} />);

    const firstPill = await screen.findByRole('button', { name: 'Choix 5' });
    const secondPill = screen.getByRole('button', { name: 'Autre 5' });

    fireEvent.click(firstPill);
    fireEvent.click(secondPill);
    expect(firstPill).toHaveProperty('ariaPressed', 'true');
    expect(secondPill).toHaveProperty('ariaPressed', 'true');

    fireEvent.click(firstPill);
    expect(firstPill).toHaveProperty('ariaPressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'saveAnswers' }));

    await waitFor(() => expect(journalQuestionsService.bulkSaveAnswers).toHaveBeenCalled());
    const payload = vi.mocked(journalQuestionsService.bulkSaveAnswers).mock.calls[0][0];
    expect(payload.answers).toEqual([{ question_id: 5, value: [second] }]);
  });

  it('falls back to dropdowns when a question has more than 8 choices', async () => {
    const manyChoices = Array.from({ length: 9 }, (_, i) => ({ id: 100 + i, label: `Option ${i}`, order: i }));
    vi.mocked(journalQuestionsService.getAnswers).mockResolvedValue({
      scope: 'day',
      questionnaire_id: 1,
      questions: [
        question(4, 'single_choice', { choices: manyChoices }),
        question(5, 'multiple_choice', { choices: manyChoices }),
      ],
      answers: [],
    });

    render(<JournalQuestionsForm scope="day" date="2026-10-04" tradingAccountId={1} />);

    expect(await screen.findByRole('button', { name: /^selectOption$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^selectOptions$/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Option 0' })).toBeNull();
  });
});

describe('JournalQuestionsForm collapsible', () => {
  it('starts collapsed, toggles open/closed, and still saves answers while collapsed', async () => {
    vi.mocked(journalQuestionsService.getAnswers).mockResolvedValue({
      scope: 'position',
      questionnaire_id: 1,
      questions: [question(1, 'boolean')],
      answers: [],
    });
    vi.mocked(journalQuestionsService.bulkSaveAnswers).mockResolvedValue({ answers: [] });
    const ref = createRef<JournalQuestionsFormHandle>();

    render(
      <JournalQuestionsForm ref={ref} scope="position" tradeId={7} compact collapsible hideSaveButton title="Questions position" />
    );

    const toggle = await screen.findByRole('button', { name: /Questions position/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'yes' })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'yes' })).toBeNull();

    await act(async () => {
      await ref.current?.save();
    });
    expect(journalQuestionsService.bulkSaveAnswers).toHaveBeenCalledWith(
      expect.objectContaining({ trade: 7, answers: [{ question_id: 1, value: true }] })
    );
  });
});

describe('JournalQuestionsForm parent-driven save', () => {
  it('hides its button, reports dirty state and saves through the ref', async () => {
    vi.mocked(journalQuestionsService.getAnswers).mockResolvedValue({
      scope: 'position',
      questionnaire_id: 1,
      questions: [question(1, 'boolean')],
      answers: [],
    });
    vi.mocked(journalQuestionsService.bulkSaveAnswers).mockResolvedValue({ answers: [] });
    const ref = createRef<JournalQuestionsFormHandle>();
    const onDirtyChange = vi.fn();

    render(
      <JournalQuestionsForm ref={ref} scope="position" tradeId={42} compact hideSaveButton onDirtyChange={onDirtyChange} />
    );

    const yes = await screen.findByRole('button', { name: 'yes' });
    expect(screen.queryByRole('button', { name: 'saveAnswers' })).toBeNull();
    expect(ref.current?.isDirty()).toBe(false);

    await ref.current?.save();
    expect(journalQuestionsService.bulkSaveAnswers).not.toHaveBeenCalled();

    fireEvent.click(yes);
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    expect(ref.current?.isDirty()).toBe(true);

    await act(async () => {
      await ref.current?.save();
    });

    expect(journalQuestionsService.bulkSaveAnswers).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'position', trade: 42, answers: [{ question_id: 1, value: true }] })
    );
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it('rejects ref.save() when the API fails so the parent can keep the modal open', async () => {
    vi.mocked(journalQuestionsService.getAnswers).mockResolvedValue({
      scope: 'position',
      questionnaire_id: 1,
      questions: [question(1, 'boolean')],
      answers: [],
    });
    vi.mocked(journalQuestionsService.bulkSaveAnswers).mockRejectedValue(new Error('boom'));
    const ref = createRef<JournalQuestionsFormHandle>();

    render(<JournalQuestionsForm ref={ref} scope="position" tradeId={42} compact hideSaveButton />);

    fireEvent.click(await screen.findByRole('button', { name: 'yes' }));

    await act(async () => {
      await expect(ref.current!.save()).rejects.toThrow('boom');
    });
    expect(screen.getByText('boom')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'yes' })).toHaveProperty('ariaPressed', 'true');
  });
});
