import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CustomSelect } from '../common/CustomSelect';
import { SettingsSection } from './SettingsSection';
import { SettingsStyleToggle } from '../ui/SettingsStyleToggle';
import { Tooltip, DeleteConfirmModal } from '../ui';
import {
  AnswerType,
  QuestionChoice,
  QuestionTemplate,
  Questionnaire,
  QuestionnaireQuestion,
  QuestionnaireScope,
  journalQuestionsService,
} from '../../services/journalQuestions';

const ANSWER_TYPES: AnswerType[] = [
  'boolean',
  'text',
  'number',
  'single_choice',
  'multiple_choice',
  'scale',
  'date',
];

const NEEDS_CHOICES = new Set<AnswerType>(['single_choice', 'multiple_choice']);

type EditorMode = 'template' | 'instance';

interface EditorState {
  mode: EditorMode;
  id?: number;
  label: string;
  help_text: string;
  answer_type: AnswerType;
  config: Record<string, unknown>;
  required: boolean;
  is_active: boolean;
  choices: QuestionChoice[];
}

const emptyEditor = (mode: EditorMode): EditorState => ({
  mode,
  label: '',
  help_text: '',
  answer_type: 'boolean',
  config: {},
  required: false,
  is_active: true,
  choices: [],
});

interface JournalQuestionsSettingsProps {
  section: 'templates' | 'day' | 'position';
  onSectionChange: (section: 'templates' | 'day' | 'position') => void;
  onMessage?: (type: 'success' | 'error', text: string) => void;
}

export const JournalQuestionsSettings: React.FC<JournalQuestionsSettingsProps> = ({
  section,
  onSectionChange,
  onMessage,
}) => {
  const { t } = useTranslation(['settings', 'journalQuestions', 'common']);
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [dayQ, setDayQ] = useState<Questionnaire | null>(null);
  const [posQ, setPosQ] = useState<Questionnaire | null>(null);
  const [dayQuestions, setDayQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [posQuestions, setPosQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorScope, setEditorScope] = useState<QuestionnaireScope | null>(null);
  const [clonePickerScope, setClonePickerScope] = useState<QuestionnaireScope | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'template' | 'instance';
    id: number;
    label: string;
  } | null>(null);

  const notify = useCallback(
    (type: 'success' | 'error', text: string) => onMessage?.(type, text),
    [onMessage]
  );
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const tRef = useRef(t);
  tRef.current = t;
  const initialLoadDone = useRef(false);

  const reload = useCallback(async () => {
    // Évite le flash « loading » au changement d'onglet / après clone / après toast parent.
    if (!initialLoadDone.current) setLoading(true);
    try {
      if (section === 'templates') {
        const tpls = await journalQuestionsService.listTemplates();
        setTemplates(tpls);
      } else if (section === 'day') {
        const [tpls, day] = await Promise.all([
          journalQuestionsService.listTemplates(true),
          journalQuestionsService.getOrCreateQuestionnaire('day'),
        ]);
        setTemplates(tpls);
        setDayQ(day);
        setDayQuestions(await journalQuestionsService.listQuestionnaireQuestions(day.id));
      } else {
        const [tpls, pos] = await Promise.all([
          journalQuestionsService.listTemplates(true),
          journalQuestionsService.getOrCreateQuestionnaire('position'),
        ]);
        setTemplates(tpls);
        setPosQ(pos);
        setPosQuestions(await journalQuestionsService.listQuestionnaireQuestions(pos.id));
      }
      initialLoadDone.current = true;
    } catch (err: any) {
      notifyRef.current('error', err?.message || tRef.current('journalQuestions:loadError'));
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    reload();
  }, [reload]);

  const openNewTemplate = () => {
    setEditorScope(null);
    setEditor(emptyEditor('template'));
  };

  const openEditTemplate = (tpl: QuestionTemplate) => {
    setEditorScope(null);
    setEditor({
      mode: 'template',
      id: tpl.id,
      label: tpl.label,
      help_text: tpl.help_text,
      answer_type: tpl.answer_type,
      config: tpl.config || {},
      required: false,
      is_active: tpl.is_active,
      choices: tpl.choices?.length ? [...tpl.choices] : [],
    });
  };

  const openNewInstance = (scope: QuestionnaireScope) => {
    setEditorScope(scope);
    setEditor(emptyEditor('instance'));
  };

  const openEditInstance = (scope: QuestionnaireScope, q: QuestionnaireQuestion) => {
    setEditorScope(scope);
    setEditor({
      mode: 'instance',
      id: q.id,
      label: q.label,
      help_text: q.help_text,
      answer_type: q.answer_type,
      config: q.config || {},
      required: q.required,
      is_active: q.is_active,
      choices: q.choices?.length ? [...q.choices] : [],
    });
  };

  const saveEditor = async () => {
    if (!editor || !editor.label.trim()) {
      notify('error', t('journalQuestions:labelRequired'));
      return;
    }
    if (NEEDS_CHOICES.has(editor.answer_type) && editor.choices.filter((c) => c.label.trim()).length === 0) {
      notify('error', t('journalQuestions:choicesRequired'));
      return;
    }
    setBusy(true);
    try {
      const choices = editor.choices
        .filter((c) => c.label.trim())
        .map((c, i) => ({ label: c.label.trim(), order: i }));
      const payload = {
        label: editor.label.trim(),
        help_text: editor.help_text,
        answer_type: editor.answer_type,
        config: editor.config,
        is_active: editor.is_active,
        choices,
      };

      if (editor.mode === 'template') {
        if (editor.id) {
          await journalQuestionsService.updateTemplate(editor.id, payload);
        } else {
          await journalQuestionsService.createTemplate(payload);
        }
      } else {
        const qId = editorScope === 'day' ? dayQ?.id : posQ?.id;
        if (!qId) throw new Error('Questionnaire missing');
        if (editor.id) {
          await journalQuestionsService.updateQuestion(editor.id, {
            ...payload,
            required: editor.required,
          });
        } else {
          await journalQuestionsService.createQuestion(qId, {
            ...payload,
            required: editor.required,
          });
        }
      }
      setEditor(null);
      notify('success', t('journalQuestions:saved'));
      await reload();
    } catch (err: any) {
      notify('error', err?.message || t('journalQuestions:saveError'));
    } finally {
      setBusy(false);
    }
  };

  const handleClone = async (scope: QuestionnaireScope, templateId: number) => {
    const qId = scope === 'day' ? dayQ?.id : posQ?.id;
    if (!qId) return;
    setBusy(true);
    try {
      await journalQuestionsService.cloneFromTemplate(qId, templateId);
      setClonePickerScope(null);
      notify('success', t('journalQuestions:clonedIndependent'));
      await reload();
    } catch (err: any) {
      notify('error', err?.message || t('journalQuestions:saveError'));
    } finally {
      setBusy(false);
    }
  };

  const requestDeleteTemplate = (id: number) => {
    const tpl = templates.find((x) => x.id === id);
    setDeleteTarget({ kind: 'template', id, label: tpl?.label || '' });
  };

  const requestDeleteInstance = (id: number) => {
    const list = section === 'day' ? dayQuestions : posQuestions;
    const q = list.find((x) => x.id === id);
    setDeleteTarget({ kind: 'instance', id, label: q?.label || '' });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      if (deleteTarget.kind === 'template') {
        await journalQuestionsService.deleteTemplate(deleteTarget.id);
        notify('success', t('journalQuestions:deleted'));
      } else {
        const result = await journalQuestionsService.deleteQuestion(deleteTarget.id);
        notify(
          'success',
          result.deactivated
            ? t('journalQuestions:deactivated')
            : t('journalQuestions:deleted')
        );
      }
      setDeleteTarget(null);
      await reload();
    } catch (err: any) {
      notify('error', err?.message || t('journalQuestions:saveError'));
    } finally {
      setBusy(false);
    }
  };

  const reorderQuestions = async (scope: QuestionnaireScope, orderedIds: number[]) => {
    const qId = scope === 'day' ? dayQ?.id : posQ?.id;
    if (!qId) return;
    const prev = scope === 'day' ? dayQuestions : posQuestions;
    const optimistic = orderedIds
      .map((id) => prev.find((q) => q.id === id))
      .filter((q): q is QuestionnaireQuestion => !!q);
    if (scope === 'day') setDayQuestions(optimistic);
    else setPosQuestions(optimistic);
    setBusy(true);
    try {
      const reordered = await journalQuestionsService.reorderQuestions(qId, orderedIds);
      if (scope === 'day') setDayQuestions(reordered);
      else setPosQuestions(reordered);
    } catch (err: any) {
      if (scope === 'day') setDayQuestions(prev);
      else setPosQuestions(prev);
      notify('error', err?.message || t('journalQuestions:saveError'));
    } finally {
      setBusy(false);
    }
  };

  const sectionTabs: Array<{ id: 'templates' | 'day' | 'position'; label: string }> = [
    { id: 'templates', label: t('settings:questionsTemplates') },
    { id: 'day', label: t('settings:questionsDay') },
    { id: 'position', label: t('settings:questionsPosition') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
        {sectionTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSectionChange(tab.id)}
            className={`flex-1 min-w-[8rem] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              section === tab.id
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">{t('journalQuestions:loading')}</p>
      ) : (
        <>
      {section === 'templates' && (
        <SettingsSection
          title={t('settings:questionsTemplates')}
          description={t('settings:questionsTemplatesDesc')}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          }
        >
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={openNewTemplate}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              {t('journalQuestions:newTemplate')}
            </button>
          </div>
          <QuestionList
            items={templates.map((tpl) => ({
              id: tpl.id,
              label: tpl.label,
              meta: t(`journalQuestions:types.${tpl.answer_type}`),
              inactive: !tpl.is_active,
            }))}
            onEdit={(id) => {
              const tpl = templates.find((x) => x.id === id);
              if (tpl) openEditTemplate(tpl);
            }}
            onDelete={requestDeleteTemplate}
          />
        </SettingsSection>
      )}

      {section === 'day' && (
        <QuestionnaireSection
          title={t('settings:questionsDay')}
          description={t('settings:questionsDayDesc')}
          questions={dayQuestions}
          onAdd={() => openNewInstance('day')}
          onClone={() => setClonePickerScope('day')}
          onEdit={(q) => openEditInstance('day', q)}
          onDelete={requestDeleteInstance}
          onReorder={(ids) => reorderQuestions('day', ids)}
          t={t}
        />
      )}

      {section === 'position' && (
        <QuestionnaireSection
          title={t('settings:questionsPosition')}
          description={t('settings:questionsPositionDesc')}
          questions={posQuestions}
          onAdd={() => openNewInstance('position')}
          onClone={() => setClonePickerScope('position')}
          onEdit={(q) => openEditInstance('position', q)}
          onDelete={requestDeleteInstance}
          onReorder={(ids) => reorderQuestions('position', ids)}
          t={t}
        />
      )}

      {editor && (
        <EditorModal
          editor={editor}
          setEditor={setEditor}
          onSave={saveEditor}
          onClose={() => setEditor(null)}
          busy={busy}
          t={t}
        />
      )}

      {clonePickerScope && (
        <ClonePickerModal
          templates={templates.filter((tpl) => tpl.is_active)}
          onPick={(id) => handleClone(clonePickerScope, id)}
          onClose={() => setClonePickerScope(null)}
          t={t}
        />
      )}
        </>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => {
          if (!busy) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        isLoading={busy}
        title={t('journalQuestions:delete')}
        message={
          deleteTarget?.kind === 'template'
            ? t('journalQuestions:confirmDeleteTemplate')
            : t('journalQuestions:confirmDeleteQuestion')
        }
        itemName={deleteTarget?.label || undefined}
        confirmButtonText={t('journalQuestions:delete')}
        cancelButtonText={t('journalQuestions:cancel')}
      />
    </div>
  );
};

function DragHandleIcon({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path d="M5 8h14M5 12h14M5 16h14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8h2M3 12h2M3 16h2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 8h2M19 12h2M19 16h2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SortableQuestionRow({
  question,
  onEdit,
  onDelete,
  t,
}: {
  question: QuestionnaireQuestion;
  onEdit: (q: QuestionnaireQuestion) => void;
  onDelete: (id: number) => void;
  t: any;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="py-3 flex items-center gap-3">
      <div
        {...attributes}
        {...listeners}
        className="cursor-move p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
        title={t('journalQuestions:dragToReorder')}
      >
        <DragHandleIcon />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm font-medium ${
            question.is_active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 line-through'
          }`}
        >
          {question.label}
        </div>
        <div className="text-xs text-gray-500">
          {t(`journalQuestions:types.${question.answer_type}`)}
          {question.required ? ` · ${t('journalQuestions:required')}` : ''}
        </div>
      </div>
      <Tooltip content={t('journalQuestions:edit')} position="top">
        <button
          type="button"
          onClick={() => onEdit(question)}
          className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={t('journalQuestions:edit')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
      </Tooltip>
      <Tooltip content={t('journalQuestions:delete')} position="top">
        <button
          type="button"
          onClick={() => onDelete(question.id)}
          className="p-2 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
          aria-label={t('journalQuestions:delete')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </Tooltip>
    </li>
  );
}

function QuestionnaireSection({
  title,
  description,
  questions,
  onAdd,
  onClone,
  onEdit,
  onDelete,
  onReorder,
  t,
}: {
  title: string;
  description: string;
  questions: QuestionnaireQuestion[];
  onAdd: () => void;
  onClone: () => void;
  onEdit: (q: QuestionnaireQuestion) => void;
  onDelete: (id: number) => void;
  onReorder: (orderedIds: number[]) => void;
  t: any;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(questions, oldIndex, newIndex).map((q) => q.id));
  };

  const activeQuestion = activeId != null ? questions.find((q) => q.id === activeId) : null;

  return (
    <SettingsSection
      title={title}
      description={description}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
    >
      <div className="flex flex-wrap gap-2 justify-end mb-3">
        <button
          type="button"
          onClick={onClone}
          className="px-3 py-1.5 text-sm rounded-lg border border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
        >
          {t('journalQuestions:addFromTemplate')}
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          {t('journalQuestions:newQuestion')}
        </button>
      </div>
      {questions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('journalQuestions:emptyQuestions')}</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {questions.map((q) => (
                <SortableQuestionRow
                  key={q.id}
                  question={q}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  t={t}
                />
              ))}
            </ul>
          </SortableContext>
          <DragOverlay>
            {activeQuestion ? (
              <div className="py-3 px-2 flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg opacity-95">
                <div className="p-1.5 text-gray-400">
                  <DragHandleIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {activeQuestion.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    {t(`journalQuestions:types.${activeQuestion.answer_type}`)}
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </SettingsSection>
  );
}

function QuestionList({
  items,
  onEdit,
  onDelete,
}: {
  items: Array<{ id: number; label: string; meta: string; inactive?: boolean }>;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation('journalQuestions');
  if (items.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('emptyTemplates')}</p>;
  }
  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
      {items.map((item) => (
        <li key={item.id} className="py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium ${item.inactive ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
              {item.label}
            </div>
            <div className="text-xs text-gray-500">{item.meta}</div>
          </div>
          <Tooltip content={t('edit')} position="top">
            <button
              type="button"
              onClick={() => onEdit(item.id)}
              className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={t('edit')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </Tooltip>
          <Tooltip content={t('delete')} position="top">
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="p-2 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
              aria-label={t('delete')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

function EditorModal({
  editor,
  setEditor,
  onSave,
  onClose,
  busy,
  t,
}: {
  editor: EditorState;
  setEditor: React.Dispatch<React.SetStateAction<EditorState | null>>;
  onSave: () => void;
  onClose: () => void;
  busy: boolean;
  t: any;
}) {
  const update = (patch: Partial<EditorState>) =>
    setEditor((prev) => (prev ? { ...prev, ...patch } : prev));

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !busy) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col transform transition-all duration-300 animate-in zoom-in-95 slide-in-from-bottom-4 border border-gray-100 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-blue-100 dark:border-blue-900/40 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3 pr-10">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {editor.id ? t('journalQuestions:edit') : t('journalQuestions:newQuestion')}
            </h2>
          </div>
          {!busy && (
            <button
              type="button"
              onClick={onClose}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute top-4 right-3 z-20 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-2 hover:bg-white/80 dark:hover:bg-gray-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
              aria-label={t('common:close')}
            >
              <svg className="w-6 h-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">{t('journalQuestions:label')}</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editor.label}
              onChange={(e) => update({ label: e.target.value })}
              disabled={busy}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">{t('journalQuestions:helpText')}</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editor.help_text}
              onChange={(e) => update({ help_text: e.target.value })}
              disabled={busy}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">{t('journalQuestions:answerType')}</span>
            <div className="mt-1">
              <CustomSelect
                value={editor.answer_type}
                disabled={busy}
                onChange={(v) => {
                  const answer_type = (v as AnswerType) || 'boolean';
                  update({
                    answer_type,
                    choices: NEEDS_CHOICES.has(answer_type) ? editor.choices : [],
                    config:
                      answer_type === 'scale'
                        ? { min: 1, max: 5, step: 1 }
                        : answer_type === 'number'
                          ? { min: undefined, max: undefined, step: 1 }
                          : {},
                  });
                }}
                options={ANSWER_TYPES.map((type) => ({
                  value: type,
                  label: t(`journalQuestions:types.${type}`),
                }))}
              />
            </div>
          </label>

          {(editor.answer_type === 'scale' || editor.answer_type === 'number') && (
            <div className="grid grid-cols-3 gap-2">
              {(['min', 'max', 'step'] as const).map((key) => (
                <label key={key} className="block text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {t(`journalQuestions:config.${key}`)}
                  </span>
                  <input
                    type="number"
                    disabled={busy}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editor.config[key] != null ? Number(editor.config[key]) : ''}
                    onChange={(e) =>
                      update({
                        config: {
                          ...editor.config,
                          [key]: e.target.value === '' ? undefined : Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}

          {NEEDS_CHOICES.has(editor.answer_type) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('journalQuestions:choices')}</span>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  onClick={() =>
                    update({
                      choices: [...editor.choices, { label: '', order: editor.choices.length }],
                    })
                  }
                >
                  {t('journalQuestions:addChoice')}
                </button>
              </div>
              {editor.choices.map((choice, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    disabled={busy}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={choice.label}
                    onChange={(e) => {
                      const choices = [...editor.choices];
                      choices[index] = { ...choice, label: e.target.value };
                      update({ choices });
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={t('journalQuestions:delete')}
                    className="w-9 h-9 flex-shrink-0 inline-flex items-center justify-center rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-50"
                    onClick={() => update({ choices: editor.choices.filter((_, i) => i !== index) })}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {editor.mode === 'instance' && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={editor.required}
                disabled={busy}
                onChange={(e) => update({ required: e.target.checked })}
              />
              {t('journalQuestions:required')}
            </label>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span>{t('journalQuestions:active')}</span>
            <SettingsStyleToggle
              pressed={editor.is_active}
              onPressedChange={(next) => update({ is_active: next })}
              disabled={busy}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('journalQuestions:cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm shadow-sm hover:shadow-md"
          >
            {busy ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {t('journalQuestions:saving')}
              </span>
            ) : (
              t('journalQuestions:save')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClonePickerModal({
  templates,
  onPick,
  onClose,
  t,
}: {
  templates: QuestionTemplate[];
  onPick: (id: number) => void;
  onClose: () => void;
  t: any;
}) {
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col transform transition-all duration-300 animate-in zoom-in-95 slide-in-from-bottom-4 border border-gray-100 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-blue-100 dark:border-blue-900/40 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3 pr-10">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {t('journalQuestions:addFromTemplate')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-4 right-3 z-20 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-2 hover:bg-white/80 dark:hover:bg-gray-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
            aria-label={t('common:close')}
          >
            <svg className="w-6 h-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('journalQuestions:cloneHint')}</p>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('journalQuestions:emptyTemplates')}</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-700">
              {templates.map((tpl) => (
                <li key={tpl.id} className="px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{tpl.label}</div>
                    <div className="text-xs text-gray-500">{t(`journalQuestions:types.${tpl.answer_type}`)}</div>
                  </div>
                  <button
                    type="button"
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                    onClick={() => onPick(tpl.id)}
                  >
                    {t('journalQuestions:add')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 font-medium text-sm"
          >
            {t('journalQuestions:cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default JournalQuestionsSettings;
