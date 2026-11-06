import type { Issue } from '@plancraft/engine';
import { useRef } from 'react';
import { Button, IssueRow, MetricTile, PanelSection, Status, Switch } from '../ui/components.tsx';
import type { Checks } from './useChecks.ts';

// The live check panel (P3.2): the plan check and the reference checks, grouped by room, each
// with its how-to-fix sentence. Clicking an issue shows it on the plan; a quick fix (offered
// only where the result is certain) is one undo step. The Vastu score shows when the plan asks
// for Vastu. Wording says "reference check", never "compliant" (CLAUDE.md rule 13).

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function IssuesPanel({
  checks,
  packs,
  vastu,
  onShow,
  onFix,
  onVastu,
}: {
  checks: Checks;
  /** Names of the rule packs the plan is checked against. */
  packs: string[];
  /** Whether the plan asks for Vastu checks. */
  vastu: boolean;
  onShow: (issue: Issue) => void;
  /** Left out when the plan is read-only: no quick fixes, no Vastu switch. True when it ran. */
  onFix?: (issue: Issue) => boolean;
  onVastu?: (on: boolean) => void;
}) {
  const of = (s: Issue['severity']) => checks.issues.filter((i) => i.severity === s).length;
  const [errors, warnings, notes] = [of('error'), of('warning'), of('info')];
  const score = checks.vastu;
  // A fixed issue's row (and its Fix button) goes away: focus moves to the summary instead.
  const summary = useRef<HTMLSpanElement>(null);
  return (
    <div className="ed-issues">
      <div className="ed-stack">
        <span className="ed-issues-summary" role="status" tabIndex={-1} ref={summary}>
          {checks.issues.length ? (
            <>
              {errors > 0 && <Status tone="error">{count(errors, 'error')}</Status>}
              {warnings > 0 && <Status tone="warn">{count(warnings, 'warning')}</Status>}
              {notes > 0 && <Status tone="accent">{count(notes, 'note')}</Status>}
            </>
          ) : (
            <Status tone="ok">Plan check and reference checks passed</Status>
          )}
        </span>
        <span className="pc-small">
          Checked against {packs.join(', ')}. Values marked “unverified” wait for the architect’s
          confirmation.
        </span>
      </div>

      <div className="ed-vastu">
        {score && (
          <div className="ed-metrics">
            <MetricTile label="Vastu score" value={String(score.value)} unit="%" bar="normal" />
          </div>
        )}
        <span className="pc-small">
          {score
            ? `${score.met} of ${count(score.total, 'preference')} met. Assumed: north points up in the drawing.`
            : vastu
              ? 'Vastu checks are on; no room they apply to yet.'
              : 'Vastu checks are off for this plan.'}
        </span>
        {onVastu && <Switch label="Vastu checks" checked={vastu} onChange={onVastu} />}
      </div>

      <div>
        {checks.groups.map((group) => (
          <PanelSection
            key={group.room_id ?? ''}
            title={group.name}
            count={group.issues.length}
            flush
          >
            {group.issues.map((issue, i) => (
              <IssueRow
                key={`${issue.rule_id}-${issue.object_ids.join()}-${i}`}
                issue={issue}
                onShow={() => onShow(issue)}
                action={
                  onFix &&
                  issue.fix && (
                    <Button
                      size="sm"
                      aria-label={`Fix: ${issue.fix.label}`}
                      title={issue.fix.label}
                      onClick={() => onFix(issue) && summary.current?.focus()}
                    >
                      Fix
                    </Button>
                  )
                }
              />
            ))}
          </PanelSection>
        ))}
      </div>
    </div>
  );
}
