import { useQuery } from '@tanstack/react-query';
import { Download, FilePlus2, FileText, Paperclip, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '../../auth/AuthContext';
import { formatDate, formatFileSize } from '../../core/format';
import { can } from '../../core/permissions';
import type { Assessment, AttachedFile, Client } from '../../core/types';
import { useData } from '../../data/DataContext';
import { useStaffNames } from '../../data/queries';
import { Button } from '../../ui/Button';
import { ErrorState, Loading } from '../../ui/common';
import { Dialog } from '../../ui/Dialog';
import { useConfirm } from '../../ui/feedback';
import { Field, FormError, Input, Textarea } from '../../ui/Field';
import { useAction, useSubmit } from '../../ui/useSubmit';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt';

function AssessmentDialog({ open, onClose, clientId, assessment }: { open: boolean; onClose: () => void; clientId: string; assessment: Assessment | null }) {
  const data = useData();
  const { submit, pending, errors, formError, reset } = useSubmit();
  const [form, setForm] = useState({ title: '', assessedOn: '', findings: '' });

  useEffect(() => {
    if (!open) return;
    reset();
    setForm(
      assessment
        ? { title: assessment.title, assessedOn: assessment.assessedOn ?? '', findings: assessment.findings ?? '' }
        : { title: '', assessedOn: '', findings: '' },
    );
  }, [open, assessment, reset]);

  const save = async () => {
    const result = await submit(
      async () => {
        if (assessment) await data.updateAssessment(assessment.id, form);
        else await data.addAssessment(clientId, form);
      },
      assessment ? 'האבחון עודכן' : 'האבחון נוסף. אפשר לצרף אליו קבצים.',
    );
    if (result.ok) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onSubmit={save}
      size="lg"
      title={assessment ? 'עריכת אבחון' : 'אבחון חדש'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" loading={pending}>
            שמירה
          </Button>
        </>
      }
    >
      <FormError>{Object.keys(errors).length ? null : formError}</FormError>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="שם האבחון" error={errors.title} required className="sm:col-span-2">
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="לדוגמה: שאלון תחומי עניין" autoFocus />
        </Field>
        <Field label="תאריך" error={errors.assessedOn}>
          <Input type="date" value={form.assessedOn} onChange={(e) => setForm((f) => ({ ...f, assessedOn: e.target.value }))} />
        </Field>
      </div>
      <Field label="ממצאים ומסקנות" error={errors.findings}>
        <Textarea value={form.findings} onChange={(e) => setForm((f) => ({ ...f, findings: e.target.value }))} rows={8} />
      </Field>
    </Dialog>
  );
}

function FilesList({ assessment, editable }: { assessment: Assessment; editable: boolean }) {
  const data = useData();
  const me = useCurrentUser();
  const confirm = useConfirm();
  const { run, pending } = useAction();
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useQuery({ queryKey: ['files', assessment.id], queryFn: () => data.listFiles(assessment.id) });

  const upload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await run(() => data.uploadFile(assessment.id, file), `הקובץ "${file.name}" צורף`);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const download = (f: AttachedFile) =>
    run(async () => {
      const { blob, fileName } = await data.downloadFile(f.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

  const remove = async (f: AttachedFile) => {
    const ok = await confirm({ title: 'מחיקת קובץ', message: `למחוק את הקובץ "${f.fileName}"? אי אפשר לבטל את המחיקה.`, confirmLabel: 'כן, למחוק', danger: true });
    if (ok) await run(() => data.deleteFile(f.id), 'הקובץ נמחק');
  };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {(query.data ?? []).length > 0 && (
        <ul className="mb-3 space-y-2">
          {query.data!.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <FileText className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium" title={f.fileName}>
                {f.fileName}
              </span>
              <span className="hidden text-sm text-slate-500 sm:inline">{formatFileSize(f.sizeBytes)}</span>
              <button type="button" onClick={() => download(f)} className="rounded-lg p-2 text-brand-700 hover:bg-brand-50" aria-label={`הורדת ${f.fileName}`} title="הורדה">
                <Download className="h-5 w-5" aria-hidden />
              </button>
              {editable && can.modifyEntry(me, { createdBy: f.uploadedBy }) && (
                <button type="button" onClick={() => remove(f)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`מחיקת ${f.fileName}`} title="מחיקה">
                  <Trash2 className="h-5 w-5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <>
          <input ref={inputRef} type="file" accept={ACCEPT} multiple className="sr-only" id={`file-${assessment.id}`} onChange={(e) => upload(e.target.files)} />
          <Button variant="secondary" size="sm" loading={pending} icon={<Paperclip className="h-4 w-4" aria-hidden />} onClick={() => inputRef.current?.click()}>
            צירוף קובץ
          </Button>
          <span className="ms-2 text-sm text-slate-500">מסמך, תמונה או PDF, עד 5 מגה</span>
        </>
      )}
    </div>
  );
}

export function AssessmentsTab({ client, editable }: { client: Client; editable: boolean }) {
  const data = useData();
  const me = useCurrentUser();
  const names = useStaffNames();
  const confirm = useConfirm();
  const { run } = useAction();
  const [dialog, setDialog] = useState<{ assessment: Assessment | null } | null>(null);
  const query = useQuery({ queryKey: ['assessments', client.id], queryFn: () => data.listAssessments(client.id) });

  const remove = async (a: Assessment) => {
    const ok = await confirm({ title: 'מחיקת אבחון', message: `למחוק את "${a.title}" כולל כל הקבצים המצורפים? אי אפשר לבטל את המחיקה.`, confirmLabel: 'כן, למחוק', danger: true });
    if (ok) await run(() => data.deleteAssessment(a.id), 'האבחון נמחק');
  };

  return (
    <div className="space-y-4">
      {editable && (
        <Button icon={<FilePlus2 className="h-5 w-5" aria-hidden />} onClick={() => setDialog({ assessment: null })}>
          הוספת אבחון
        </Button>
      )}
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data!.length === 0 ? (
        <p className="text-slate-500">עדיין לא נוספו אבחונים.</p>
      ) : (
        <ul className="space-y-3">
          {query.data!.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{a.title}</p>
                  <p className="text-sm text-slate-500">
                    {a.assessedOn ? `${formatDate(a.assessedOn)} · ` : ''}נוסף ע"י {names(a.createdBy)}
                  </p>
                </div>
                {editable && (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setDialog({ assessment: a })} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={`עריכת ${a.title}`} title="עריכה">
                      <Pencil className="h-5 w-5" aria-hidden />
                    </button>
                    {can.modifyEntry(me, a) && (
                      <button type="button" onClick={() => remove(a)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`מחיקת ${a.title}`} title="מחיקה">
                        <Trash2 className="h-5 w-5" aria-hidden />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {a.findings && <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-800">{a.findings}</p>}
              <FilesList assessment={a} editable={editable} />
            </li>
          ))}
        </ul>
      )}
      <AssessmentDialog open={dialog !== null} onClose={() => setDialog(null)} clientId={client.id} assessment={dialog?.assessment ?? null} />
    </div>
  );
}
