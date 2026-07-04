# Users and Profiles Visual Alignment

## Goal

Make Users and Profiles read as one interface. Profiles is the visual reference for list structure, filters, controls, and actions. Both contextual editors must provide enough room for comfortable editing.

## Scope

- Align the Users catalog with the Profiles catalog:
  - contained table with framed header and rows;
  - matching row height, padding, borders, radii, typography, and selected state;
  - matching compact action buttons;
  - the existing five user columns and responsive card behavior remain.
- Align filter text fields and native selects in both catalogs with the application's established controls:
  - 42–44 px minimum height;
  - 8 px radius;
  - panel-derived background, border, hover, and amber focus ring;
  - consistent typography and internal padding.
- Increase both contextual panels to `720px` on desktop.
  - Below `900px`, panels use the full viewport width.
  - Increase header, body, section, field, and footer spacing.
  - Preserve independent body scrolling and fixed actions.
- Keep all service calls, filtering behavior, validation, confirmation flows, focus management, and responsive information hierarchy unchanged.

## Visual Rules

Profiles remains the source of truth. Users should not introduce a parallel table or button language. Both catalogs use the same control geometry and action treatment; semantic danger color remains reserved for destructive or deactivation actions.

Panel width is used to reduce visual compression, not to add more columns. Forms remain easy to scan vertically, with wider fields, more whitespace between sections, and less crowded permission and branch content.

## Responsive Behavior

- Desktop: framed five-column catalogs and `720px` side panels.
- Tablet: catalogs become two-column cards; panels occupy the viewport width.
- Mobile: filters, cards, and actions stack without horizontal overflow; controls remain at least 44 px high.

## Verification

- Style regression specs compare catalog geometry, controls, action buttons, and panel width.
- Existing component and integration specs must continue passing.
- Visual review at `1280 × 800`, `768 × 1024`, and `375 × 812`.
- Confirm no horizontal overflow and no panel content hidden behind navigation.
