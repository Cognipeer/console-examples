import type { PendingAction, ResolveActionBody } from '@cognipeer/console-sdk';

const denyPatterns = (process.env.DENY_PATTERNS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Decide what to answer for one pending action. This is the only place you need to replace
 * with real logic (a ticket system, a Slack message to a human, a rules engine...).
 *
 * Returns null when the action kind is not one this demo answers (for example a page tool,
 * which only the person's browser may answer).
 */
export function decide(action: PendingAction): ResolveActionBody | null {
  if (action.kind === 'tool_approval') {
    const argsText = JSON.stringify(action.args ?? {});
    const hit = denyPatterns.find((p) => argsText.includes(p));
    if (hit) {
      // The agent sees this comment, so say why.
      return { decision: 'deny', comment: `Denied by policy: arguments contain "${hit}".` };
    }
    // Approve as-is. To change what runs, add approved_args: { ... } (must satisfy the tool's schema).
    return { decision: 'allow' };
  }

  if (action.kind === 'user_question') {
    // `answers` is keyed by the QUESTION TEXT. A value naming one of the options is a selection;
    // any other text is free text, which the question must allow (allow_free_text).
    const answers: Record<string, string | string[]> = {};
    for (const q of action.questions ?? []) {
      const first = q.options?.[0];
      if (!first) {
        if (q.required === false || !action.allow_free_text) continue;
        answers[q.question] = 'No preference.';
        continue;
      }
      const value = first.value ?? first.label;
      answers[q.question] = q.multi_select ? [value] : value;
    }
    // If nothing could be answered, skip the question instead of leaving the turn paused.
    return Object.keys(answers).length > 0 ? { answers } : { cancelled: true };
  }

  return null;
}
