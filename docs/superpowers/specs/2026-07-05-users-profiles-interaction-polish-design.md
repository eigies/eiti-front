# Users and Profiles Interaction Polish

## Goal

Refine the remaining rough interaction details in Users and Profiles so they match the established application language: pill-shaped permission summaries, softer custom checks, and the same drawer motion used by Customers.

## Scope

### Permission summary chips

- Keep the existing inherited-permission grouping and labels.
- Render permission actions as rounded pills instead of square tags.
- Use a subtle amber-tinted background, soft border, and compact readable padding.

### Branch checks

- Preserve the current branch selection behavior and `Todas las sucursales` semantics.
- Replace the hard square indicator with a 20px rounded custom check.
- Add clear checked, hover, focus-visible, disabled, and unrestricted states.
- Keep branch rows easy to scan with restrained hover/background transitions.

### Profile permission checks

- Keep native checkbox semantics and current immutable selection events.
- Restyle the checkbox with `appearance: none`, a rounded outline, animated check mark, and accessible focus ring.
- Soften selected permission rows by replacing the hard left bar with a subtle border and amber-tinted background.
- Apply the same custom check language to `Sólo seleccionados`.

### Panel motion

- Apply the Customers drawer timing and easing to both User and Profile panels:
  - entry: `420ms cubic-bezier(.16, 1, .3, 1)`;
  - exit: `240ms cubic-bezier(.4, 0, 1, 1)`;
  - backdrop entry: `280ms`;
  - backdrop exit: `220ms`.
- Keep each panel mounted while its exit animation runs.
- Confirm dirty-close requests before starting the exit animation.
- Disable repeated close/save actions while a panel is closing.
- Finalize state, restore focus, and clear the selected entity only after the exit duration.
- Clear pending close timers on component destruction.
- Preserve the existing reduced-motion rule; closing state still finalizes predictably.

## Architecture

`UsersComponent` remains the coordinator. It owns `userPanelClosing` and `profilePanelClosing`, applies a closing class to each panel host, and delays final teardown by 240ms. The panel components remain responsible for dialog focus trapping and form behavior; their styles respond to the host closing class.

No service contract, permission model, validation rule, or API payload changes.

## Verification

- TDD coverage for delayed close state, stale/repeated requests, and final teardown.
- Style regression coverage for pill radii, custom check geometry, selected-row treatment, and both entry/exit keyframes.
- Full Angular test suite and production build.
- Browser review of both panels and checks at desktop and mobile widths, with no overflow or hidden controls.
