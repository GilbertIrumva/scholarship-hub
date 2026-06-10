import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, ShieldCheck, ShieldQuestion, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  scorePassword,
  checkPasswordBreached,
  evaluatePasswordPolicy,
} from '@/lib/passwordSecurity';

/**
 * PasswordStrengthMeter
 *
 * Renders a strength bar (zxcvbn 0-4 → percent + label) plus a breach badge
 * (HIBP k-anonymity). Designed to sit directly under a <PasswordInput />.
 *
 * Props:
 *   password       (string)    — the current input value
 *   userInputs     (string[])  — optional context (email, name) so leaked
 *                                PII is penalised by zxcvbn
 *   onEvaluate     (fn)        — called with `{ score, breached, count,
 *                                policy }` whenever the evaluation changes.
 *                                Parent uses this to gate submit buttons.
 *   minScore       (number)    — bar tint switches to "ok" at this score
 *                                (default 2; matches evaluatePasswordPolicy)
 *   debounceMs     (number)    — defaults to 500ms; controls both the scoring
 *                                AND the HIBP request
 *
 * Behaviour notes:
 *   - The strength bar and label render immediately for any non-empty value
 *     (after the debounce); the breach line shows "Checking…" until the HIBP
 *     request settles, then either a danger or success line.
 *   - HIBP failures degrade gracefully ("Could not reach breach service.")
 *     and do NOT block submission — only confirmed breaches do.
 *   - On unmount or while a new keystroke arrives, the in-flight HIBP request
 *     is aborted via AbortController.
 */
export const PasswordStrengthMeter = React.forwardRef(function PasswordStrengthMeter(
  { password, userInputs = [], onEvaluate, minScore = 2, debounceMs = 500, className },
  _ref,
) {
  const { t } = useTranslation();
  const [state, setState] = React.useState({
    score: 0,
    label: '',
    percent: 0,
    warning: '',
    suggestions: [],
    breached: false,
    count: 0,
    breachError: false,
    checking: false,
  });

  // Keep the latest callback in a ref so the effect does not re-run when the
  // parent passes an inline function.
  const onEvaluateRef = React.useRef(onEvaluate);
  React.useEffect(() => {
    onEvaluateRef.current = onEvaluate;
  }, [onEvaluate]);

  // Serialise userInputs so React's dep array can compare cheaply.
  const userInputsKey = React.useMemo(() => userInputs.join('|'), [userInputs]);

  React.useEffect(() => {
    if (!password) {
      setState({
        score: 0,
        label: '',
        percent: 0,
        warning: '',
        suggestions: [],
        breached: false,
        count: 0,
        breachError: false,
        checking: false,
      });
      onEvaluateRef.current?.({
        score: 0,
        breached: false,
        count: 0,
        policy: evaluatePasswordPolicy({ score: 0, breached: false }),
      });
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    setState((s) => ({ ...s, checking: true }));

    const timer = setTimeout(async () => {
      const inputs = userInputsKey ? userInputsKey.split('|') : [];
      const strength = await scorePassword(password, inputs);
      if (cancelled) return;
      // Show the score immediately even before HIBP completes.
      setState((s) => ({
        ...s,
        ...strength,
        checking: true,
      }));

      const breach = await checkPasswordBreached(password, { signal: controller.signal });
      if (cancelled) return;
      const next = {
        ...strength,
        breached: breach.breached,
        count: breach.count,
        breachError: Boolean(breach.error),
        checking: false,
      };
      setState(next);
      onEvaluateRef.current?.({
        score: strength.score,
        breached: breach.breached,
        count: breach.count,
        policy: evaluatePasswordPolicy({ score: strength.score, breached: breach.breached }),
      });
    }, debounceMs);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [password, userInputsKey, debounceMs]);

  if (!password) return null;

  const meetsMin = state.score >= minScore;
  const barTone = state.breached
    ? 'bg-red-500'
    : state.score >= 4
      ? 'bg-emerald-500'
      : state.score === 3
        ? 'bg-emerald-400'
        : state.score === 2
          ? 'bg-amber-400'
          : 'bg-red-400';

  const labelTone = state.breached
    ? 'text-red-600'
    : meetsMin
      ? 'text-emerald-600'
      : 'text-amber-600';

  return (
    <div className={cn('mt-2 space-y-2 text-xs', className)} aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('font-medium', labelTone)}>
          {state.label
            ? t(`passwordMeter.strength.${state.score}`, { defaultValue: state.label })
            : t('passwordMeter.checking')}
        </span>
        {state.checking && (
          <span className="inline-flex items-center gap-1 text-muted">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {t('passwordMeter.checking')}
          </span>
        )}
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/50"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state.percent}
        aria-label={t('passwordMeter.barLabel')}
      >
        <div
          className={cn('h-full transition-all duration-300', barTone)}
          style={{ width: `${state.percent}%` }}
        />
      </div>

      {state.breached ? (
        <p className="inline-flex items-start gap-1.5 text-red-600">
          <ShieldAlert className="mt-[2px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {t('passwordMeter.breached', {
              count: state.count,
              formattedCount: state.count.toLocaleString(),
            })}
          </span>
        </p>
      ) : state.breachError ? (
        <p className="inline-flex items-start gap-1.5 text-muted">
          <ShieldQuestion className="mt-[2px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t('passwordMeter.breachError')}</span>
        </p>
      ) : !state.checking && meetsMin ? (
        <p className="inline-flex items-start gap-1.5 text-emerald-600">
          <ShieldCheck className="mt-[2px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t('passwordMeter.notBreached')}</span>
        </p>
      ) : null}

      {(state.warning || state.suggestions.length > 0) && !state.breached && (
        <ul className="space-y-0.5 text-muted">
          {state.warning && <li>{state.warning}</li>}
          {state.suggestions.slice(0, 2).map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      )}
    </div>
  );
});
