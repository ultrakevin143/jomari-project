---
name: "Waste Operations Data Hub"
description: "A legible municipal control desk for service reliability, integrations, and data trust."
colors:
  background: "#f5f7f8"
  surface: "#fff"
  foreground: "#1e3038"
  muted: "#63737b"
  border: "#e0e6e8"
  subtle: "#f7f9fa"
  primary: "#176b58"
  primary-hover: "#115445"
  focus: "#2c8875"
  sidebar: "#17313a"
  sidebar-muted: "#a6bbc2"
  success: "#23705b"
  success-bg: "#eaf5f0"
  warning: "#9a5c13"
  warning-bg: "#fff4de"
  error: "#ad393e"
  error-bg: "#fcecee"
  info: "#326a91"
  info-bg: "#eaf2f8"
  chart-scheduled: "#d8e5e6"
  chart-completed: "#2a7c68"
  dark-background: "#101b21"
  dark-surface: "#19282f"
  dark-foreground: "#e2eaf0"
  dark-muted: "#a4b4bd"
  dark-border: "#31424b"
  dark-subtle: "#1c2e36"
  dark-primary: "#297e68"
  dark-primary-hover: "#35957c"
  dark-focus: "#5bb99f"
  dark-sidebar: "#0d1b22"
  dark-sidebar-muted: "#a1b5bf"
  dark-success: "#89d6b6"
  dark-success-bg: "#173c33"
  dark-warning: "#f0c176"
  dark-warning-bg: "#3b3021"
  dark-error: "#f5a4aa"
  dark-error-bg: "#432a30"
  dark-info: "#9bc6e6"
  dark-info-bg: "#243c50"
  dark-chart-scheduled: "#3c5961"
  dark-chart-completed: "#54ac8c"
  white: "#fff"
  sidebar-foreground: "#e5f0f2"
  sidebar-link: "#b6c9d0"
  sidebar-active: "#2e4b54"
  sidebar-active-icon: "#a6d7c6"
typography:
  headline:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "27px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.012em"
  body:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 550
    lineHeight: 1.5
  control:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.4
  table:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
  table-heading:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "10px"
    fontWeight: 550
    lineHeight: 1.5
  metric:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "31px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  badge:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1.6
  code:
    fontFamily: "Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.7
  dialog:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "-0.02em"
rounded:
  badge: "5px"
  icon: "6px"
  control: "7px"
  menu: "8px"
  notice: "9px"
  tile: "10px"
  surface: "12px"
  dialog: "14px"
spacing:
  "7": "7px"
  "8": "8px"
  "9": "9px"
  "12": "12px"
  "16": "16px"
  "18": "18px"
  "20": "20px"
  "22": "22px"
  "24": "24px"
  "30": "30px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
  button-outline-hover:
    backgroundColor: "{colors.subtle}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
  button-ghost-hover:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.foreground}"
  button-destructive:
    backgroundColor: "{colors.error}"
    textColor: "{colors.white}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "8px 11px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.surface}"
  badge-neutral:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.muted}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
  badge-success:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
  badge-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
  badge-error:
    backgroundColor: "{colors.error-bg}"
    textColor: "{colors.error}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
  badge-info:
    backgroundColor: "{colors.info-bg}"
    textColor: "{colors.info}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
  nav-item:
    textColor: "{colors.sidebar-link}"
    rounded: "{rounded.control}"
    padding: "11px 13px"
  nav-item-active:
    backgroundColor: "{colors.sidebar-active}"
    textColor: "{colors.white}"
  metric:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.metric}"
    padding: "18px 21px 16px"
  quarantine-record:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.notice}"
    padding: "17px"
---

# Design System: Waste Operations Data Hub

## Overview

**Creative North Star: "The Municipal Control Desk"**

The Municipal Control Desk is a compact, legible working environment for municipal operations staff. Cool canvas and white work surfaces support scannable tables; deep blue-gray navigation anchors the workspace; evergreen marks deliberate actions and drill-downs.

A single sans family carries headings, controls, and records. Tabular figures, explicit dates, visible focus, and status words make service exceptions and data trust readable. The console is built from CSS, Lucide line icons, accessible Radix primitives, and text; no shipping raster assets define its identity.

**Key Characteristics:**

- Cool off-white canvas, flat white work surfaces, and deep blue-gray navigation.
- Evergreen actions with text-labeled green, amber, red, and blue status states.
- Compact tables, tabular figures, explicit dates, and traceable record details.
- Responsive containment, a mobile navigation Sheet, and on-demand refresh.

This is the system extracted from the finished console. The frontmatter records the implemented primitives; `frontend/app/globals.css` and `frontend/src/shared/ui/index.tsx` remain the implementation sources. Page strategy belongs in `docs/dashboard-surface.md`.

## Colors

The palette combines an evergreen action accent, cool neutrals, and functional state colors. The frontmatter is normative; `dark-*` entries are the values applied by the existing `.dark` class, not a second identity.

### Primary

- **Evergreen** (`primary`) fills primary actions and colors drill-down links and selected tabs.
- **Deep Evergreen** (`primary-hover`) darkens enabled primary actions on hover.
- **Focus Green** (`focus`) supplies the visible keyboard outline and focused-field border.

### Neutral

- **Cool Canvas** (`background`) sits behind work surfaces.
- **White Work Surface** (`surface`) holds cards, controls, and the top bar; **Subtle Wash** (`subtle`) separates headers, footnotes, payload blocks, and hover rows.
- **Blue-gray Ink** (`foreground`) carries primary text; **Slate Text** (`muted`) carries supporting text.
- **Cool Divider** (`border`) separates cells, panels, and shell regions.
- **Deep Blue-gray Navigation** (`sidebar`) anchors the shell. Navigation has dedicated muted text, link, active-surface, foreground, and active-icon values; preserve those roles.
- **White** (`white`) remains fixed for filled action text. It does not switch to the dark surface value.

### Semantic state and chart roles

- **Success Green / Success Wash** mark successful, completed, available, or resolved states.
- **Warning Amber / Warning Wash** mark partial results, open issues, stale sources, and attention.
- **Error Red / Error Wash** mark failures, missed service, restrictions, and validation errors.
- **Information Blue / Information Wash** mark running or assigned work and informational notices.
- **Scheduled Mist / Completed Green** (`chart-scheduled`, `chart-completed`) encode the paired chart bars and progress tracks. The chart legend names both series.

**The Status Has Words Rule.** Pair semantic color with a readable state label or explanation. A dot or hue alone never carries the operational meaning.

Dark mode replaces every semantic `:root` color through the `.dark` selector while retaining the same roles. Fixed sidebar selection colors and white filled-button labels remain as implemented. Sidecar tonal ramps are generated inspection strips only; they are not additional application palettes or CSS tokens.

## Typography

**Body and interface family:** Segoe UI, with Apple system, BlinkMacSystemFont, Arial, and sans-serif fallbacks.
**Label/Mono family:** Consolas with SFMono-Regular and monospace for source identifiers and record details; the payload editor uses Consolas with a monospace fallback.

The console uses one practical sans family, compact line lengths, and a clear jump from record text to measured values. Headings are working labels rather than decorative display treatments.

### Hierarchy

- **Headline:** the frontmatter `headline` role is the page title; mobile page titles reduce to (23px).
- **Title:** `title` is the default panel heading. Smaller record headings inherit the body size with a heavier weight; the quality explanation uses (17px).
- **Body:** `body` defines the page base. Most explanatory copy and fields use (12–13px); field help is capped at (70ch), and dialog descriptions at (65ch).
- **Label:** `label` is the form-label role. Controls use `control`; table rows and headings use their separate compact roles.
- **Metric:** `metric` uses tabular figures. The implemented responsive sizes are (28px) at the compact desktop breakpoint, (29px) on mobile, and (35px) on wide screens. Quality and report summaries keep their own contextual number sizes.
- **Badge:** `badge` keeps short state words compact and readable.
- **Code:** `code` is the structured-payload editor. Source IDs and detail payloads also use the mono family at the sizes required by their table or detail context.
- **Dialog:** `dialog` is the record-dialog title and reduces to (18px) on mobile.

**The Record Readability Rule.** Use tabular figures for measured values, right-align numeric table cells, and reserve monospace for source identifiers and structured payloads.

Do not derive a new type scale from one-off brand straplines, micro-labels, or the login display treatment.

## Layout

The desktop shell has a fixed left sidebar (232px), a top bar (60px), and a content column capped at (1680px). Default content padding is (27px 30px 38px). Work surfaces use compact internal rhythm: cards have header padding (20px 22px), fields have a (7px) label gap, and adjacent form actions use a (9px) gap. The spacing frontmatter lists observed reused steps rather than an invented modular scale.

The overview metric strip uses four equal columns and internal dividers. Its chart and source panel use `minmax(0, 1.57fr) minmax(310px, 1fr)` with a (22px) gap. Flexible app/content/metric/chart regions retain `min-width: 0`. Tables scroll inside their own full-width region; long detail values and payloads wrap within their container.

Responsive behavior follows the shipped media queries:

- At widths up to (1250px), the sidebar becomes (210px), content padding becomes (25px 22px), the period controls stack beneath context, and catalog grids reduce to two columns.
- At widths up to (1000px), the chart and source panel stack, metrics become two columns, source rows form a two-column list, and governance lineage becomes vertical.
- At widths up to (760px), the sidebar is replaced by the navigation Sheet, the top bar becomes (56px), content uses (23px 16px 30px) padding, sources become one column, filters stack, and form grids become one column. The metric strip stays two columns. Tables keep a (600px) minimum width inside a horizontal scroll region with contained overscroll.
- At widths from (1600px), content padding grows to (35px 40px), metric padding to (22px 25px), and the chart's maximum height to (260px).

The mobile navigation Sheet is (280px) wide with an (85vw) maximum. Standard dialogs use viewport width minus (32px), a (500px) maximum width, and a (90dvh) maximum height; wide dialogs cap at (800px). Mobile dialogs allow (92dvh).

## Elevation & Depth

The console has no box-shadow vocabulary. Depth comes from canvas/surface contrast, subtle header and footnote fills, one-pixel borders, and the fixed navigation rail. Modal overlays use the existing translucent blue-gray scrim (`#0e202966`) with a (2px) backdrop blur. Overlay, dialog/Sheet, select, and tooltip layers use the existing stacking order (80, 90, 110, 120).

**The Flat Work Surface Rule.** Separate work surfaces with tone and one-pixel borders. Do not introduce box shadows into the console's resting surfaces.

State transitions change background, text, or border color over (160ms) with the CSS default easing; they do not move or lift controls. Loading skeletons pulse opacity from (0.5) to (0.85) over (1.7s), using ease-in-out. The reduced-motion media query reduces animation and transition duration to (0.01ms), limits animation to one iteration, and uses automatic scroll behavior.

## Shapes

Corners are gently curved and scaled by role: state badges use `rounded.badge`; buttons and fields use `rounded.control`; cards and the metric strip use `rounded.surface`; dialogs use `rounded.dialog`. Menus, notices, and catalog tiles have their own observed intermediate steps. Borders are thin and structural. Circular source indicators and avatars remain reserved for their existing status/identity roles. Charts use small (2px) bar corners rather than pill bars.

## Components

### Buttons

Compact, clearly labeled actions. The default button has a minimum height (36px), a (7px) icon gap, the `control` type role, and the shape/padding captured in frontmatter. Primary buttons use evergreen and fixed white text. Outline buttons use surface, border, and foreground; ghost buttons use transparent backgrounds and muted text; destructive buttons use error and fixed white text. Enabled primary, outline, and ghost variants have the recorded hover colors. Disabled buttons reduce opacity to (0.55).

Small buttons use minimum height (31px), padding (5px 10px), and type size (12px). Icon buttons use a (33px) square; pagers use their existing (28px) variation. Preserve accessible action names. Keyboard focus uses the shared outline (2px) with a (3px) offset.

### Chips

State badges are compact labels, not filter buttons. Their neutral, success, warning, error, and info variants combine matching text/background pairs, the `badge` type role, and a small rectangular radius. The Status component converts machine values to sentence-case words. Selected governance catalog tiles and underlined tabs carry selection; a badge does not stand in for selection.

### Cards / Containers

Flat containers use surface, a one-pixel divider border, and the shared surface radius. Overflow is clipped at the card edge. Card headers align title/context with a relevant action and separate the body with a divider. Header padding adapts at the existing breakpoints. Record tables use subtle header fills, row dividers, and a subtle row hover; numeric cells align right and use tabular figures.

### Inputs / Fields

Fields use a one-pixel border, surface fill, foreground text, the control radius, and padding (8px 11px), with minimum height (37px). Labels stay visible; muted placeholders supplement them. Focus changes the border to focus green and uses the shared outline with a (2px) field offset. Textareas have a minimum height (95px) and resize vertically. Select triggers share the field shape; menu items show highlight and checked state. Validation feedback uses labeled error text or an error alert.

### Navigation

The rail pairs Lucide line icons with text. Items use (12.5px) type, padding (11px 13px), and the control radius. Hover uses the existing translucent white wash; the active item uses the dedicated navigation surface, white text, a muted green icon, and heavier weight. The mobile Sheet reuses the same navigation content and labeled close action.

Section tabs use a lower divider and an evergreen (2px) underline for the active item. Keep the selected state visible alongside the label.

### Operational summaries and charts

Measured values use tabular figures and contextual units. Linked metric cells show a quiet hover wash and lead to the related records. Progress bars are (5px) high and use the scheduled/completed pair. The collection chart groups longer reporting periods into at most seven plotted intervals. Its SVG uses a (640 × 215) view box and an (80px) left plot inset; mobile axis labels use (22px) SVG-space type so the scaled chart remains legible. Preserve the legend, dates, SVG title/description, and the report link.

### Record and exception details

An exception row includes its service date so repeated route codes remain distinguishable. Record ordering controls name their field where needed; operational records identify source update time. A detail dialog uses a labeled definition list, wrapping structured values and bounded payload blocks.

Quarantined records show a row/source identifier, remediation state, validation reason, error code, retry count, and the correction action. The correction form keeps the JSON field visibly labeled and pairs Cancel with the explicit save-and-retry action. Keep successful records outside this remediation flow.

### Account and historical views

Account administration reuses the flat card, visibly labeled fields, recorded-change reason, and explicit form actions. Saved quality snapshots retain their timestamp and selected-snapshot context, with an explicit return to the latest snapshot. Quality history pairs the evergreen line chart with exact values in compact tables; keep the chart and wide tables contained on narrow screens. Reliability findings reuse dated route links, status words, and right-aligned numeric records.

### Feedback and loading

Errors use the error color pair, a Lucide alert icon, a specific heading, and an explicit retry action when appropriate. Empty states use a quiet icon, a direct heading, and a next step. Skeletons stand in for loading content and respect reduced motion. Data loads and retries remain on demand.

## Do's and Don'ts

### Do:

- **Do** reuse the semantic color variables and their existing dark-theme replacements.
- **Do** keep status words beside state colors and provide accessible names for icon-only actions.
- **Do** preserve visible focus, labeled fields, keyboard navigation, and explicit apply, search, refresh, and retry actions.
- **Do** show reporting periods and service dates, and identify the field behind an ordering control.
- **Do** contain wide tables inside their scroll region and wrap long record values inside detail panels.
- **Do** keep chart legends, date ticks, and an accessible description with the plotted values.

### Don't:

- **Don't** add decorative eyebrows above working page titles or section headings.
- **Don't** turn semantic warning, error, or information colors into extra brand accents.
- **Don't** add gradients, ornamental imagery, or raised card effects to the console.
- **Don't** hide status meaning or record actions behind color alone.
- **Don't** force wide tables to widen the page or shrink chart labels until their reporting intervals are unreadable.
- **Don't** add automatic dashboard polling, focus or reconnect refresh, or automatic error-retry loops.

