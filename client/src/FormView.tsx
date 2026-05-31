import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@oa-agent/ui';
import type { Definition, FieldSpec, SubmissionInfo } from './api';
import { resolveFieldRenderer } from './form/registry';

interface Props {
  def: Definition;
  values: Record<string, unknown>;
  submission?: SubmissionInfo | null;
  busy?: boolean;
  /** confirming：送出前確認（draft 為編輯後的值）；submitted 時不提供 */
  onConfirm?: (draft: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  onClose: () => void;
}

/** 唯讀顯示字串：enum 用 field options 的中文 label，空值顯示破折號 */
function displayValue(spec: FieldSpec | undefined, raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  if (spec?.options?.length) {
    const opt = spec.options.find((o) => o.value === String(raw));
    if (opt) return opt.label;
  }
  return String(raw);
}

export default function FormView({
  def,
  values,
  submission,
  busy,
  onConfirm,
  onCancel,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const submitted = !!submission;
  // 欄位來源依 data.properties；若有 layout schema，顯示順序與分組交給 layout 決定。
  const fieldKeys = Object.keys(def.data.properties);
  const required = new Set(def.validation?.required ?? []);
  const layoutRows = def.layout?.sections.flatMap((section) => section.fields) ?? [];
  const layoutFieldKeys = new Set(layoutRows.flat());
  const extraFieldKeys = fieldKeys.filter((key) => !layoutFieldKeys.has(key));
  const sections =
    def.layout?.sections
      .map((section) => ({
        title: section.title,
        rows: section.fields
          .map((row) => row.filter((key) => fieldKeys.includes(key)))
          .filter((row) => row.length > 0),
      }))
      .filter((section) => section.rows.length > 0) ?? [];

  if (extraFieldKeys.length > 0) {
    sections.push({ title: undefined, rows: extraFieldKeys.map((key) => [key]) });
  }

  // 編輯草稿：confirming 模式才用，初值取自已蒐集的 values
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...values }));
  const [err, setErr] = useState<string | null>(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const lastSectionIndex = Math.max(sections.length - 1, 0);
  const currentSectionIndex = Math.min(activeSectionIndex, lastSectionIndex);
  const currentSection = sections[currentSectionIndex];
  const hasSteps = sections.length > 1 && !submitted;
  const currentSectionKeys = currentSection?.rows.flat() ?? [];
  const allRequiredFilled = (def.validation?.required ?? []).every((key) => !isRequiredMissing(key));
  const currentRequiredFilled = currentSectionKeys
    .filter((key) => required.has(key))
    .every((key) => !isRequiredMissing(key));
  const isLastSection = currentSectionIndex === lastSectionIndex;

  function setField(key: string, val: string) {
    setErr(null);
    setDraft((d) => ({ ...d, [key]: val }));
  }

  function isRequiredMissing(key: string): boolean {
    if (!required.has(key)) return false;
    const raw = draft[key];
    if (raw === null || raw === undefined) return true;
    return String(raw).trim() === '';
  }

  function requiredMessage(keys: string[]): string {
    const labels = keys
      .filter((key) => isRequiredMissing(key))
      .map((key) => def.field[key]?.label ?? key);
    return labels.length > 0
      ? t('form.requiredMissing', { fields: labels.join('、') })
      : t('form.incomplete');
  }

  function handleNext() {
    const missingKeys = currentSectionKeys.filter((key) => isRequiredMissing(key));
    if (missingKeys.length > 0) {
      setErr(requiredMessage(missingKeys));
      return;
    }
    setErr(null);
    setActiveSectionIndex((idx) => Math.min(idx + 1, lastSectionIndex));
  }

  async function handleConfirm() {
    if (!onConfirm) return;
    setErr(null);
    const missingKeys = (def.validation?.required ?? []).filter((key) => isRequiredMissing(key));
    if (missingKeys.length > 0) {
      setErr(requiredMessage(missingKeys));
      return;
    }
    try {
      await onConfirm(draft);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('form.submit'));
    }
  }

  function renderField(key: string) {
    const spec = def.field[key];
    if (!spec) return null;
    // 依 schema 的 component 從 registry 取對應設計系統元件
    const Renderer = resolveFieldRenderer(spec.component);
    const raw = draft[key];
    const v = raw === null || raw === undefined ? '' : String(raw);

    return (
      <div className="form-field" key={key}>
        <dt className="form-label">
          {spec.label}
          {required.has(key) && <span className="form-required">*</span>}
        </dt>
        <dd className="form-value">
          {submitted ? (
            displayValue(spec, values[key])
          ) : (
            <Renderer
              spec={spec}
              value={v}
              disabled={busy}
              onChange={(val) => setField(key, val)}
            />
          )}
        </dd>
      </div>
    );
  }

  return (
    <div className="form-overlay" onClick={submitted ? onClose : undefined}>
      <div className="form-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="form-sheet-head">
          <h2 className="form-sheet-title">
            {submitted
              ? (def.data.title ?? def.formId)
              : t('form.confirmTitle', { title: def.data.title ?? def.formId })}
          </h2>
          {submitted && <span className="form-stamp">{t('form.submitted')}</span>}
          <button className="form-close" onClick={onClose} type="button" aria-label={t('app.cancel')}>
            ✕
          </button>
        </div>

        {!submitted && <p className="form-hint">{t('form.hint')}</p>}

        {hasSteps && (
          <div className="form-tabs" role="tablist" aria-label={t('form.steps')}>
            {sections.map((section, sectionIndex) => {
              const sectionKeys = section.rows.flat();
              const isComplete = sectionKeys
                .filter((key) => required.has(key))
                .every((key) => !isRequiredMissing(key));
              return (
                <button
                  aria-selected={sectionIndex === currentSectionIndex}
                  className={[
                    'form-tab',
                    sectionIndex === currentSectionIndex ? 'active' : '',
                    isComplete ? 'complete' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={`${section.title ?? 'section'}-${sectionIndex}`}
                  onClick={() => {
                    setErr(null);
                    setActiveSectionIndex(sectionIndex);
                  }}
                  role="tab"
                  type="button"
                >
                  <span>{sectionIndex + 1}</span>
                  {section.title ?? t('form.step', { index: sectionIndex + 1 })}
                </button>
              );
            })}
          </div>
        )}

        <div className="form-layout">
          {(hasSteps && currentSection ? [currentSection] : sections).map((section, sectionIndex) => (
            <section
              className="form-section"
              key={`${section.title ?? 'section'}-${hasSteps ? currentSectionIndex : sectionIndex}`}
            >
              {section.title && <h3 className="form-section-title">{section.title}</h3>}
              <dl className="form-grid">
                {section.rows.map((row, rowIndex) => (
                  <div
                    className="form-row"
                    key={`${section.title ?? 'section'}-${rowIndex}-${row.join('-')}`}
                    style={{ '--form-row-columns': row.length } as CSSProperties}
                  >
                    {row.map((key) => renderField(key))}
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        {submitted && (
          <div className="form-receipt">
            <div className="kv-row">
              <span className="kv-key">{t('app.oaNo')}</span>
              <span className="kv-val">{submission.oaRequestId}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">{t('app.statusField')}</span>
              <span className="kv-val">{submission.status}</span>
            </div>
          </div>
        )}

        {err && <p className="form-error">{err}</p>}

        <div className="form-actions">
          {submitted ? (
            <Button variant="confirm" size="md" onClick={onClose} type="button">
              {t('form.complete')}
            </Button>
          ) : (
            <>
              <Button variant="cancel" size="md" onClick={onCancel} type="button" disabled={busy}>
                {t('app.cancel')}
              </Button>
              {hasSteps && currentSectionIndex > 0 && (
                <Button
                  variant="reset"
                  size="md"
                  onClick={() => {
                    setErr(null);
                    setActiveSectionIndex((idx) => Math.max(idx - 1, 0));
                  }}
                  type="button"
                  disabled={busy}
                >
                  {t('form.previous')}
                </Button>
              )}
              {hasSteps && !isLastSection ? (
                <Button
                  variant="confirm"
                  size="md"
                  onClick={handleNext}
                  type="button"
                  disabled={busy || !currentRequiredFilled}
                >
                  {t('form.next')}
                </Button>
              ) : (
                <Button
                  variant="confirm"
                  size="md"
                  onClick={handleConfirm}
                  type="button"
                  disabled={busy || !allRequiredFilled}
                >
                  {busy ? t('form.submitting') : t('form.submit')}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
