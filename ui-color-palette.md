Apple Design System — Completion
The following sections fill the gaps in the original analysis. They preserve the original's token grammar ({category.token}), depth, and "do/don't" cadence so they slot directly into the existing document.

Motion & Animation
Apple's motion is restrained, photographic, and built on a single easing curve. Movement exists to confirm an action or to reveal content as the eye reaches it — never to entertain. The system runs on three durations and one signature ease, and the press-scale (transform: scale(0.95)) documented in the buttons section is the most-used animation in the entire library.

Easing
Token	Curve	Use
{ease.standard}	cubic-bezier(0.28, 0.11, 0.32, 1)	The signature "Apple ease." Default for every transition: button press, opacity fade, scroll-driven reveal, sticky-bar entrance
{ease.linear}	linear	Indeterminate progress bars, looping skeleton fades
{ease.in}	cubic-bezier(0.42, 0, 1, 1)	Exit/dismiss only — sheet dismiss, modal close
{ease.out}	cubic-bezier(0, 0, 0.58, 1)	Entrance only — sheet open, tooltip appear
Duration
Token	Value	Use
{duration.instant}	100ms	Press-scale return, hover color change
{duration.quick}	200ms	Button press, focus ring, link color change
{duration.standard}	400ms	Modal open, sheet present, sticky-bar slide-in
{duration.expressive}	600ms	Hero parallax pulses, scroll-revealed photography fade-in
{duration.scroll-reveal}	800ms	The slow above-fold image opacity ramp on the homepage
Motion Patterns
Press-scale ({motion.press-scale}): transform: scale(0.95) over {duration.quick} with {ease.standard}. Returns to 1.0 over {duration.instant} on release. Applied to every tappable surface.
Sticky-bar reveal ({motion.sticky-reveal}): {component.floating-sticky-bar} translates from translateY(100%) to translateY(0) with opacity 0 → 1 over {duration.standard} once the user has scrolled past the configurator's first decision.
Sub-nav slide-in ({motion.sub-nav-pin}): {component.sub-nav-frosted} fades its frosted backdrop in over {duration.quick} once it pins below the global nav.
Hero parallax ({motion.hero-parallax}): Above-fold product photography moves at 0.6× scroll velocity. Implemented with transform: translate3d(0, calc(var(--scroll) * 0.4), 0). Disabled at {breakpoint.phone} and below.
Section reveal ({motion.section-reveal}): As a tile crosses the 80% viewport threshold, headline and product render fade in (opacity 0 → 1) and rise 24px. Stagger between headline and image is 100ms.
Carousel slide ({motion.carousel-slide}): Horizontal translateX over {duration.standard} with {ease.standard}. No bounce, no overshoot.
Reduced Motion
Apple respects prefers-reduced-motion: reduce:

All {motion.hero-parallax}, {motion.section-reveal}, and {motion.carousel-slide} collapse to instantaneous opacity changes.
{motion.press-scale} is preserved (it's a confirmation cue, not decoration).
{motion.sticky-reveal} becomes an instant appear.
Iconography
System
Apple's web icons are flat, monoline, and sized to typography. On Apple platforms the rendering uses SF Symbols (the platform widget); on web they ship as inline SVG with currentColor fills so they inherit text color.

Sizes
Token	Size	Stroke	Use
{icon.xs}	12 × 12	1px	Inline within {typography.fine-print}
{icon.sm}	14 × 14	1.25px	Search glyph in {component.search-input}, inline link arrows
{icon.md}	17 × 17	1.5px	Default UI icon — bag, search, chevron in nav
{icon.lg}	24 × 24	1.5px	Carousel controls, in-image controls
{icon.xl}	40 × 40	2px	Marketing-tile feature glyphs (rare)
Style Rules
Monoline only. No filled icons except checkmark and the closed bag (cart with content).
Stroke caps and joins are rounded (stroke-linecap: round; stroke-linejoin: round).
Color is always currentColor — icons inherit from their text context.
No two-tone, no gradient, no decorative outline.
Common Glyphs
The set surfaced across the analyzed pages: chevron-down, chevron-right, chevron-up, search, bag, bag-filled (count > 0), close-x, play, pause, plus, minus, check, info-circle, external-link. All ship as 24 × 24 viewBox SVG masters and scale to the size tokens above.

Z-Index & Stacking
Apple's stacking is intentionally shallow — there are five named layers and the system never improvises in between.

Token	Value	Use
{z.base}	0	Default flow content, product tiles
{z.sticky}	100	{component.sub-nav-frosted} and {component.floating-sticky-bar}
{z.global-nav}	200	{component.global-nav} — always above sub-nav
{z.overlay-backdrop}	900	Modal/sheet backdrop scrim
{z.overlay-content}	1000	Modal, sheet, and dialog cards
{z.toast}	1100	Toast and notification surfaces (above modals)
{z.tooltip}	1200	Tooltips and popovers (above everything)
Hover States
The original document deliberately omitted hover, but the system does ship a quiet hover language for desktop pointers. Hover never adds chrome — it only shifts color or opacity by a fraction.

Element	At Rest	On Hover
{component.button-primary}	{colors.primary} fill	Fill darkens to #0077ed over {duration.quick}
{component.button-secondary-pill}	Transparent fill, {colors.primary} border	Fill becomes {colors.primary} at 8% alpha
{component.button-dark-utility}	{colors.ink} fill	Fill lightens to #2d2d2f
{component.text-link}	{colors.primary}, no underline	Underline appears (text-decoration: underline)
{component.text-link-on-dark}	{colors.primary-on-dark}, no underline	Underline appears
{component.store-utility-card}	1px {colors.hairline} border	Border opacity fades to 0 and product imagery scales to 1.02 over {duration.standard}
{component.configurator-option-chip}	1px {colors.hairline} border	Border darkens to rgba(0, 0, 0, 0.16)
Global nav links	{colors.body-on-dark}	Opacity drops to 0.85
Rule: hover is a 5–15% nudge, never a transformation. If a state needs more than a color or opacity shift to read as interactive, the element wasn't styled correctly at rest.

Components — Form Inputs
The original surfaced only {component.search-input}. The full input system follows the same pill/rect grammar already established and lives entirely on light surfaces.

text-input
Rectangular text input. Background {colors.canvas}, text {colors.ink} in {typography.body} (17px), 1px solid rgba(0, 0, 0, 0.08) border, rounded {rounded.sm} (8px), padding 12px × 16px, height 44px. Float-label pattern: label sits as placeholder at rest, animates to 11px above the input on focus or when filled.

text-input-focus: border becomes 2px solid {colors.primary-focus}, outline: none. Label color shifts to {colors.primary}.
text-input-error: border becomes 2px solid {colors.danger} (#e30000). Inline error message in {typography.caption} {colors.danger} appears 4px below the input.
text-input-disabled: background {colors.canvas-parchment}, text {colors.ink-muted-48}, no border focus.
textarea
Same chassis as {component.text-input}, minimum height 96px, resize: vertical. Top-aligned label, no float pattern (label is static above the field).

select
Chevron-down dropdown. Same chassis as {component.text-input}, with a trailing 14px chevron in {colors.ink-muted-80} aligned to the right edge with 16px padding. On open, the menu appears as a {component.popover}.

checkbox
Apple's signature rounded-square checkbox. 22 × 22, {rounded.xs} (5px), 1.5px border rgba(0, 0, 0, 0.32) at rest. Selected: fill becomes {colors.primary}, border disappears, white check glyph at {icon.sm}. Label sits 12px to the right in {typography.body}.

radio
22 × 22 circle, 1.5px border rgba(0, 0, 0, 0.32). Selected: 2px outer border {colors.primary} with an 8px inner-circle fill {colors.primary} (concentric ring, not solid). Label sits 12px to the right.

toggle-switch
iOS-style switch. Track 51 × 31, {rounded.pill}. At rest: track fill #e9e9eb, knob 27 × 27 white circle with the system product-shadow. On: track fill {colors.primary}, knob slides from translateX(0) to translateX(20px) over {duration.quick} with {ease.standard}. The on-state green seen on iOS settings is iOS-only and does not appear on web.

segmented-control
Pill-shaped horizontal selector. Container background #e9e9eb, rounded {rounded.pill}, padding 2px. Each segment is a label in {typography.caption-strong} (14px / 600), padding 6px × 16px. Selected segment: white background, system product-shadow, slides between positions over {duration.quick}.

stepper
Used in the bag/cart for quantity. Two {component.button-icon-circular} (minus/plus) flanking a numeric value in {typography.body-strong}. Total width ~120px.

slider
Used in configurators (rare). Track 4px tall, fill {colors.primary}, unfilled #e9e9eb, rounded {rounded.pill}. Knob 28 × 28 white circle with product-shadow. Active state: knob scales to 1.1 over {duration.instant}.

Components — Feedback & Status
toast
Slides up from bottom-center on desktop, top on mobile. Background {colors.ink}, text {colors.body-on-dark} in {typography.body} (17px), {rounded.md} (11px), padding 14px × 20px, max-width 400px. Optional 14px icon (check, info-circle, close-x) at leading edge. Auto-dismiss after 4000ms with fade + slide-down over {duration.standard}.

toast-success: leading icon check in {colors.success}.
toast-error: leading icon info-circle in {colors.danger}.
inline-banner
Full-width attention strip at the top of a section (e.g., shipping notice on store hero). Background {colors.canvas-parchment}, text {colors.ink} in {typography.caption-strong}, padding 12px × 24px, no border, no radius. Optional trailing {component.text-link}.

progress-linear
4px tall, full available width. Track #e9e9eb, fill {colors.primary}, both {rounded.pill}. Determinate: width animates to target. Indeterminate: a 30%-width bar slides 0 → 100% repeatedly with {ease.linear} over 1600ms.

progress-circular
SVG ring. 24 × 24 default (also 16 and 40). Stroke 2px ({icon.md} size), {colors.primary} for the active arc, #e9e9eb for the track. Indeterminate: the arc rotates over 1200ms with {ease.linear}. Used during configurator add-to-bag and during page-level loads.

skeleton
Loading placeholder. Background #e9e9eb. Shape matches the content it represents: {rounded.sm} (8px) for text-line skeletons, {rounded.lg} (18px) for utility-card skeletons, full pill for chip skeletons. Animation: opacity oscillates between 1.0 and 0.6 over 1400ms with {ease.linear}. No shimmer — Apple uses pure fade.

badge
Small status marker. Two grammars exist:

badge-text-only: {typography.caption-strong} (14px / 600), no background, color {colors.primary}. Used for "New" labels on store grid cards.
badge-count: red circular indicator on the bag icon when the cart has items. 18 × 18, fill {colors.danger}, white text in {typography.fine-print} (12px), {rounded.full}.
empty-state
Centered stack inside a container. 40 × 40 muted icon ({icon.xl} in {colors.ink-muted-48}), 16px gap, headline in {typography.tagline} (21px / 600 / {colors.ink}), 8px gap, subcopy in {typography.body} (17px / 400 / {colors.ink-muted-80}), 24px gap, optional {component.button-primary}. Vertical padding {spacing.xxl} (48px) minimum.

Components — Navigation & Wayfinding
tabs-underline
Horizontal tab strip. No background fill. Each tab: {typography.body-strong} (17px / 600), padding 12px × 0 (horizontal padding lives on the gap, 32px between tabs). Inactive: {colors.ink-muted-80}, no underline. Active: {colors.ink}, 2px solid {colors.primary} underline 4px below the baseline. The underline animates between positions over {duration.standard}.

Apple does not use pill tabs on web. Tabs are always underline.

breadcrumbs
Inline link trail. {typography.caption} (14px), {colors.ink-muted-80} separators (chevron-right {icon.xs}), {colors.primary} for clickable crumbs, {colors.ink} for current page (non-clickable). Used on store category pages.

pagination
Numbered page selector. Each page is a 36 × 36 pill, {typography.caption-strong}, transparent at rest, fill {colors.primary} + white text on selected. Previous/next are {component.button-icon-circular} at 36px sizing. Center-aligned, 4px gap.

anchor-jump
Sticky in-page nav (used on long product detail pages). Functions as a {component.sub-nav-frosted} variant — same frosted-glass surface — with section anchors as inline links. Active section's link gets {colors.primary} color.

Components — Overlays
modal
Centered card on desktop, full-screen sheet on ≤ {breakpoint.tablet-portrait}. Card: background {colors.canvas}, {rounded.lg} (18px) on desktop, {rounded.none} full-screen on mobile, max-width 560px, padding {spacing.xl} (32px). Trailing close button is {component.button-icon-circular} in the top-right corner with 16px inset.

Backdrop: rgba(0, 0, 0, 0.4) with backdrop-filter: blur(20px) saturate(180%).
Entrance: backdrop fades 0 → 1 over {duration.quick}. Card fades and scales from 0.96 to 1.0 over {duration.standard} with {ease.out}.
Exit: reverse, with {ease.in}.
Z-index: {z.overlay-content}.
sheet-bottom
Mobile-native bottom sheet, also used on desktop for cart-preview and quick-look surfaces. Slides up from the bottom edge. Background {colors.canvas}, top corners {rounded.lg} (18px), bottom corners {rounded.none}, padding {spacing.xl}. Optional 36 × 4 {rounded.pill} "grab handle" centered 8px from the top edge. Same backdrop and timing as {component.modal}.

popover
Floating card anchored to a trigger element. Background {colors.canvas}, 1px solid {colors.hairline}, {rounded.md} (11px), padding {spacing.md} (17px), max-width 320px. The single product-shadow IS used here (this is the one UI exception to the "shadow only on photography" rule — popovers need the lift to read as floating). Optional 8px caret pointing to the trigger.

tooltip
Smaller, simpler version of popover. Background {colors.ink}, text {colors.body-on-dark} in {typography.fine-print} (12px), {rounded.sm} (8px), padding 6px × 10px, max-width 240px. Optional 6px caret. Appears on hover after 500ms delay; disappears immediately on blur.

Components — Data Display
spec-table
Apple's signature spec/comparison table. Vertical product columns (2–4), horizontal spec rows (Display, Chip, Camera, etc.).

Container: full-bleed within the section, no outer border.
Column headers: {typography.tagline} (21px / 600), product name centered, optional product render above.
Row labels: {typography.body-strong} (17px / 600), left-aligned, sticky on horizontal scroll.
Cell content: {typography.body} (17px), centered.
Row separator: 1px {colors.hairline} between rows only — never between columns.
Vertical padding: {spacing.lg} (24px) per row.
Sticky behavior: column headers stick on vertical scroll; row labels stick on horizontal scroll at mobile.
feature-list
Vertical bullet list with checkmark glyphs. Each item: check {icon.md} in {colors.success} + 12px gap + {typography.body}. Vertical gap between items 12px. Used on plan-comparison and product-feature surfaces.

data-row
Generic key-value display (used in cart, order summary). Two-column flex: label left in {typography.body} {colors.ink-muted-80}, value right in {typography.body-strong}. Padding 8px vertical, no border. Used inside {component.modal} and the persistent cart panel.

price-block
Composed price display. Strikethrough original price in {typography.caption} {colors.ink-muted-48} above the current price in {typography.display-md} (34px / 600 / {colors.ink}). Optional savings note in {typography.caption-strong} {colors.success} below.

swatch-picker
Color-option grid for product configurators. Each swatch is a 36 × 36 circle, {rounded.full}, with a 2px white inner ring and a 1px {colors.hairline} outer ring. Selected: outer ring upgrades to 2px solid {colors.primary} with a 4px gap from the swatch fill. Label sits in {typography.caption} below or in a {component.tooltip} on hover.

Validation & Error States
The original called this out as a known gap. The system uses three semantic colors:

Token	Value	Use
{colors.success}	#008a00	Success states, checkmark icons in feature lists, price savings
{colors.warning}	#b25000	Shipping delay banners, low-stock notices
{colors.danger}	#e30000	Error borders, error messages, cart-count badge
Inline Field Validation
Triggered on blur (not on every keystroke). Layout: input → 4px gap → error message in {typography.caption} {colors.danger}, prefixed by an info-circle {icon.xs} glyph. The input border becomes 2px solid {colors.danger}. Float-labels keep their position; only the border and message change.

Form-Level Errors
A {component.inline-banner} appears at the top of the form with background rgba(227, 0, 0, 0.06), text {colors.danger}, listing the count of invalid fields. Banner persists until all fields validate. Auto-scrolls into view on submit attempt.

Success Confirmation
Field-level: check {icon.sm} in {colors.success} appears at the trailing edge of the input on successful blur. Form-level: {component.toast} with success variant.

Dark Mode
Apple's marketing surfaces are predominantly light, but a true dark counterpart exists for the store, accessories, and account surfaces. The original analysis surfaced only the daytime variant — here is the dark counterpart system.

Surface Inversion
Light Token	Dark Counterpart	Hex
{colors.canvas}	{colors.canvas-dark}	#000000
{colors.canvas-parchment}	{colors.canvas-parchment-dark}	#1d1d1f
{colors.surface-pearl}	{colors.surface-pearl-dark}	#2a2a2c
{colors.ink}	{colors.ink-dark}	#f5f5f7
{colors.body-muted} (already dark-only)	{colors.body-muted-dark}	#86868b
{colors.hairline}	{colors.hairline-dark}	rgba(255, 255, 255, 0.16)
Component Inversions
{component.store-utility-card-dark}: background {colors.canvas-parchment-dark}, border 1px {colors.hairline-dark}, otherwise identical.
{component.text-input-dark}: background {colors.surface-pearl-dark}, border rgba(255, 255, 255, 0.12), focus border {colors.primary-on-dark}.
{component.modal-dark}: card {colors.canvas-parchment-dark}, backdrop rgba(0, 0, 0, 0.6) with the same blur.
Action Color in Dark Mode
{colors.primary} (Action Blue) is replaced by {colors.primary-on-dark} (Sky Link Blue #2997ff) for all interactive elements. The pill CTA fill becomes Sky Link Blue; the focus outline uses the same.

Photography Behavior
Product renders are art-directed for the surface — Apple ships separate dark-background hero crops rather than recoloring a light render. The system shadow weakens to rgba(0, 0, 0, 0.5) 3px 5px 30px to retain contrast against the darker tile.

Accessibility
Contrast
Body text on {colors.canvas} clears WCAG AAA ({colors.ink} on white = 16.07:1).
{colors.body-muted} on {colors.surface-tile-1} clears AA at 17px+ but not AAA.
{colors.primary} on {colors.canvas} clears AA for normal text (4.55:1), AAA for large text (≥ 18px / 600).
{colors.primary-on-dark} on {colors.surface-tile-1} clears AA for normal text.
{colors.ink-muted-48} is approved only for fine-print and disabled states; it does not clear AA at body sizes.
Focus
All interactive elements receive a 2px solid {colors.primary-focus} outline with 2px offset on :focus-visible.
Outlines are never removed without replacement.
Focus order follows DOM order; no tabindex values above 0.
Motion
All {motion.*} tokens listed under "Reduced Motion" above respect prefers-reduced-motion: reduce.
The press-scale is preserved across both states because it functions as confirmation.
Touch & Target
Minimum 44 × 44px hit area on all tappable surfaces (already documented in the original).
Inline {component.text-link} does not meet the 44px target by default; it relies on the surrounding line-height (~25px) plus paragraph spacing for adequate vertical reach. On dense link lists (footer), the relaxed {typography.dense-link} line-height (2.41) brings each link's hit area into compliance.
Screen Reader
All {component.button-icon-circular} instances ship with aria-label.
{component.product-tile-light} and dark variants use <section aria-labelledby> referencing the headline.
Carousels use aria-roledescription="carousel" with live-region announcements on slide change.
Decorative product imagery has alt=""; informational product imagery has descriptive alt text matching the product name.
Token Schema (Reference)
For agents implementing the system, the token grammar referenced throughout uses this YAML structure:

colors:
  primary: "#0066cc"
  primary-focus: "#0071e3"
  primary-on-dark: "#2997ff"
  canvas: "#ffffff"
  canvas-parchment: "#f5f5f7"
  ink: "#1d1d1f"
  # ...all color tokens

typography:
  hero-display:
    font: "SF Pro Display"
    size: 56
    weight: 600
    line-height: 1.07
    letter-spacing: -0.28
  # ...all type tokens

spacing:
  xxs: 4
  xs: 8
  sm: 12
  md: 17
  lg: 24
  xl: 32
  xxl: 48
  section: 80

rounded:
  none: 0
  xs: 5
  sm: 8
  md: 11
  lg: 18
  pill: 9999
  full: 9999

ease:
  standard: "cubic-bezier(0.28, 0.11, 0.32, 1)"
  in: "cubic-bezier(0.42, 0, 1, 1)"
  out: "cubic-bezier(0, 0, 0.58, 1)"

duration:
  instant: 100
  quick: 200
  standard: 400
  expressive: 600

z:
  base: 0
  sticky: 100
  global-nav: 200
  overlay-backdrop: 900
  overlay-content: 1000
  toast: 1100
  tooltip: 1200

components:
  button-primary:
    background: "{colors.primary}"
    color: "{colors.on-primary}"
    typography: "{typography.body}"
    radius: "{rounded.pill}"
    padding: [11, 22]
    transition: "all {duration.quick} {ease.standard}"
  # ...all components
Updated Do's and Don'ts
These extend the original list rather than replace it.

Do
Use {ease.standard} (cubic-bezier(0.28, 0.11, 0.32, 1)) as the default ease on every transition. The Apple feel comes from the curve, not the duration.
Treat hover as a 5–15% nudge — color shift, opacity shift, or micro-scale. Never add chrome.
Reserve the product-shadow exception for {component.popover} only. No other UI element gets a shadow.
Use {colors.primary-on-dark} (Sky Link Blue) for every interactive element when the surface inverts to dark mode.
Animate {component.tabs-underline} between positions over {duration.standard} — the underline traveling is the brand cue.
Use float labels on text inputs. Static labels above inputs are reserved for textareas only.
Validate forms on blur, not on keystroke. Apple's forms are calm.
Don't
Don't introduce a shimmer animation on skeleton states. Apple uses fade only.
Don't use a green-track iOS toggle on web. The on-state color is {colors.primary} (Action Blue), not iOS green.
Don't use filled icons except check and bag-filled (cart-with-content). Every other glyph is monoline.
Don't ship pill-shaped tabs. Tabs are always underline on web.
Don't put the global nav above z-index 200 or the modal above 1000. The five-layer stacking is fixed.
Don't omit prefers-reduced-motion handling. The hero parallax and section reveal must collapse.
Don't use {colors.danger} (red) for anything other than error states. It is the only "stop" color in the system.
Updated Known Gaps
The original gaps that remain:

Dynamic hero copy still varies per surface and is not formalized as a token.
Backdrop-filter blur radius remains platform-dependent; the recommended baseline is saturate(180%) blur(20px).
Newly closed:

Form validation and error states (now documented).
Dark-mode counterparts for utility cards and forms (now documented).
Hover states (now documented).
Motion tokens (now documented).
Iconography system (now documented).
Z-index scale (now documented).
Accessibility specifications (now documented).
Still genuinely missing because Apple does not surface them publicly:

Internationalization tokens (RTL mirroring rules, locale-specific typography fallbacks).
Print stylesheet conventions.
Email-template grammar (uses a different and reduced subset of this system).