// Επεξεργασία κατηγοριών.
//
// Ο χρήστης μπορεί να μετονομάσει τα πάντα, να αλλάξει την ελαστικότητα και να
// βάλει μηνιαίο πλαφόν. Οι προεπιλεγμένες κατηγορίες δεν διαγράφονται, μόνο
// αρχειοθετούνται: αν τις σβήναμε, οι παλιές συναλλαγές θα έμεναν ορφανές και
// τα περσινά σύνολα θα άλλαζαν.
//
// Η ελαστικότητα εξηγείται δίπλα στο πεδίο. Δεν είναι αυτονόητη ετικέτα και
// καθορίζει τι θεωρείται «γούστο», άρα και το μηνιαίο όριο.
//
// Η μετονομασία απαιτεί πάντα και επιλογή ομάδας. Χωρίς ομάδα, η κατηγορία δεν
// αθροίζεται πουθενά και ο χρήστης βλέπει έξοδα που δεν εμφανίζονται στα σύνολα.

import { useState } from 'react';
import type { Category, CategoryEdit, Flexibility } from '../../types/finance';
import {
  applyCategoryEdit,
  canDelete,
  categoryName,
  groupCategories,
  groupsForKind,
  validateCategory,
} from '../../lib/categories';
import { DEFAULT_CURRENCY } from '../../lib/currency';
import { formatMoney } from '../../lib/money';

const FLEXIBILITIES: Flexibility[] = ['fixed', 'semi_flexible', 'flexible'];

interface CategoryEditorProps {
  categories: Category[];
  t: (key: string, params?: Record<string, unknown>) => string;
  locale?: string;
  currency?: string;
  /** Πόσες συναλλαγές έχει κάθε κατηγορία, για να ξέρουμε τι διαγράφεται. */
  usageByCategory?: Record<string, number>;
  onChange: (category: Category) => void;
  onDelete?: (categoryId: string) => void;
  onCreate?: (parentId: string) => void;
}

export function CategoryEditor({
  categories,
  t,
  locale = 'el-GR',
  currency = DEFAULT_CURRENCY,
  usageByCategory = {},
  onChange,
  onDelete,
  onCreate,
}: CategoryEditorProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = groupCategories(categories);

  return (
    <div className="space-y-5">
      {groups.map(({ group, children }) => (
        <section
          key={group.id}
          className="rounded-xl border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <header
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <h3 className="font-[var(--font-display)] text-sm font-semibold uppercase tracking-wide">
              {categoryName(group, t)}
            </h3>
            {onCreate && (
              <button
                type="button"
                onClick={() => onCreate(group.id)}
                className="text-xs font-medium"
                style={{ color: 'var(--accent)' }}
              >
                {t('categoryEditor.add')}
              </button>
            )}
          </header>

          <ul>
            {children.map((category) => {
              const isOpen = openId === category.id;
              const update = (edit: CategoryEdit) =>
                onChange(applyCategoryEdit(category, edit));

              return (
                <li key={category.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : category.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center px-4 py-2.5 text-left text-sm"
                  >
                    <span>{categoryName(category, t)}</span>
                    <span className="leader" aria-hidden />
                    <span className="tnum text-xs" style={{ color: 'var(--text-muted)' }}>
                      {category.monthlyBudgetCents
                        ? formatMoney(category.monthlyBudgetCents, locale, currency)
                        : t(`categoryEditor.flex.${category.flexibility}`)}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="space-y-3 px-4 pb-4">
                      <Field label={t('categoryEditor.name')}>
                        <input
                          type="text"
                          value={category.customName ?? categoryName(category, t)}
                          onChange={(e) => update({ customName: e.target.value })}
                          className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm"
                          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                        />
                      </Field>

                      <Field
                        label={t('categoryEditor.group')}
                        error={
                          validateCategory(category).errors.parent
                            ? t('categoryEditor.errors.parentRequired')
                            : undefined
                        }
                      >
                        <select
                          value={category.parentId ?? ''}
                          onChange={(e) => update({ parentId: e.target.value })}
                          required
                          className="w-full rounded-md border px-2 py-1.5 text-sm"
                          style={{
                            borderColor: 'var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                          }}
                        >
                          <option value="" disabled>
                            {t('categoryEditor.chooseGroup')}
                          </option>
                          {groupsForKind(
                            categories,
                            category.kind === 'both' ? 'expense' : category.kind,
                          ).map((g) => (
                            <option key={g.id} value={g.id}>
                              {categoryName(g, t)}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field
                        label={t('categoryEditor.flexibility')}
                        hint={t(`categoryEditor.flexHint.${category.flexibility}`)}
                      >
                        <select
                          value={category.flexibility}
                          onChange={(e) => update({ flexibility: e.target.value as Flexibility })}
                          className="w-full rounded-md border px-2 py-1.5 text-sm"
                          style={{
                            borderColor: 'var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                          }}
                        >
                          {FLEXIBILITIES.map((f) => (
                            <option key={f} value={f}>
                              {t(`categoryEditor.flex.${f}`)}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label={t('categoryEditor.budget')} hint={t('categoryEditor.budgetHint')}>
                        <input
                          type="number"
                          min={0}
                          step="5"
                          value={
                            category.monthlyBudgetCents !== undefined
                              ? category.monthlyBudgetCents / 100
                              : ''
                          }
                          onChange={(e) =>
                            update({
                              monthlyBudgetCents: e.target.value
                                ? Math.round(Number(e.target.value) * 100)
                                : undefined,
                            })
                          }
                          className="tnum w-full rounded-md border bg-transparent px-2 py-1.5 text-sm"
                          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                        />
                      </Field>

                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={category.userProtected ?? false}
                          onChange={(e) => update({ userProtected: e.target.checked })}
                          className="mt-0.5"
                        />
                        <span>
                          {t('categoryEditor.protected')}
                          <span
                            className="block text-[11px] leading-snug"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {t('categoryEditor.protectedHint')}
                          </span>
                        </span>
                      </label>

                      <div className="flex flex-wrap gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => update({ archived: !category.archived })}
                          className="text-xs"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {t(category.archived ? 'categoryEditor.restore' : 'categoryEditor.archive')}
                        </button>

                        {onDelete && canDelete(category, usageByCategory[category.id] ?? 0) && (
                          <button
                            type="button"
                            onClick={() => onDelete(category.id)}
                            className="text-xs"
                            style={{ color: 'var(--expense)' }}
                          >
                            {t('categoryEditor.delete')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {error ? (
        <span className="mt-1 block text-[11px] leading-snug" style={{ color: 'var(--expense)' }}>
          {error}
        </span>
      ) : (
        hint && (
          <span className="mt-1 block text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </span>
        )
      )}
    </label>
  );
}
