import {
  checkPlan,
  groupIssues,
  vastuScore,
  type DerivedRoom,
  type Issue,
  type IssueGroup,
  type Plan,
  type VastuScore,
} from '@plancraft/engine';
import { useEffect, useRef, useState } from 'react';

// The live checks (P3.2): the plan check and the reference checks of the plan's rule packs run
// again after every change, once changes settle for a moment (a burst of arrow-key nudges or
// typed values is checked once). A drag is checked when it ends, not while it is previewed.

/** Short enough that an issue shows within 300 ms of a change (P3.2 ✅). */
export const CHECK_DELAY_MS = 120;

export interface Checks {
  /** The plan check's issues (geometry, format), then the reference checks'. */
  issues: Issue[];
  groups: IssueGroup[];
  /** Null when the plan doesn't ask for Vastu or nothing is there to judge yet. */
  vastu: VastuScore | null;
}

/** The plan check is already done for the drawing: its issues and rooms are passed in. */
export interface Validated {
  plan: Plan;
  /** False when the plan fails the format check: then only that check's issues are shown. */
  valid: boolean;
  issues: Issue[];
  rooms: DerivedRoom[];
}

export function runChecks({ plan, valid, issues, rooms }: Validated): Checks {
  const all = valid ? [...issues, ...checkPlan(plan, { rooms })] : issues;
  return {
    issues: all,
    groups: groupIssues(plan, all, rooms),
    vastu: valid ? vastuScore(plan, { rooms }) : null,
  };
}

/** The checks of `validated`, refreshed `CHECK_DELAY_MS` after it last changed. */
export function useChecks(validated: Validated): Checks {
  const [checks, setChecks] = useState(() => runChecks(validated));
  const shown = useRef(validated);
  useEffect(() => {
    if (shown.current === validated) return;
    const t = setTimeout(() => {
      shown.current = validated;
      setChecks(runChecks(validated));
    }, CHECK_DELAY_MS);
    return () => clearTimeout(t);
  }, [validated]);
  return checks;
}
