# Endeavor integration

Integration branch: `merge/endeavor-latest`

Source inputs:
- Current `main`: deployment pipeline and latest visual baseline.
- Kartik's 2026-09-28 Endeavor export: later product/functional implementation.

Merge rule: preserve current deployment infrastructure and reconcile the export's later functional changes into the application/database layer. Do not deploy this branch directly until build/database compatibility is verified.

Key export deltas include Your Goals under Today, personal routines and weekly schedules, comparison grids and multi-select comparisons, goal start dates, public/friend profile visibility, notification preferences, profile-photo crop/zoom, and later Feed/Groups/Calendar/Settings UX.

Validation status: PR CI configured; integration remains blocked from main until lint/build pass.
