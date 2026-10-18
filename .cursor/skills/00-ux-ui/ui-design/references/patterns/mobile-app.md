# Pattern: Mobile App

Applies to iOS, Android and cross-platform apps (and mobile web that should feel app-like). Follow platform conventions (Apple Human Interface Guidelines, Material 3) unless the existing product defines its own system, which then wins.

## Structure

- **Navigation:** bottom tab bar with 3-5 destinations (icon plus label), a top bar with title and at most 2 actions. Deep flows push screens with a clear back control. Avoid hamburger menus for primary navigation.
- **One primary task per screen** and one primary action, placed in the thumb zone (bottom CTA or FAB).
- **Sheets:** use bottom sheets for secondary choices and quick edits; full screens for tasks that need focus.
- **Onboarding:** value first, 3 screens at most, skippable; ask for permissions in context with a short reason before the system prompt.

## Layout and touch

- Touch targets at least 44pt (iOS) or 48dp (Android), with 8dp spacing. Body text at least 16px (17pt on iOS); support dynamic type.
- Respect safe areas, notches and gesture bars. Content margins 16-20px.
- List rows 56-72px with clear leading visual, primary text, secondary text and trailing action. Swipe actions must have a visible alternative.
- Keep forms short; one idea per screen for long flows with a visible progress indicator; save drafts.
- Keyboard: correct input type and `autocomplete`, move focus sensibly, keep the primary button visible above the keyboard, never cover the focused field.

## Behavior

- **Loading and connectivity:** skeletons, optimistic updates when safe, pull-to-refresh, clear offline and retry states, queued actions with status.
- **Feedback:** haptics sparingly for confirmation; toasts or snackbars for non-blocking messages; undo for destructive actions.
- **Gestures:** supplement, never replace, visible controls; avoid conflicting with system gestures.
- **Notifications:** useful and rare; never place sensitive content in them.
- **Dark mode** and **reduced motion** supported; test with large text.
- **Authentication:** biometrics and passkeys where possible, session persistence, easy recovery.

## Data on a small screen

- Summary cards first, with drill-down to detail. Max one small chart per fold, sized for thumbs and legible (at least 200px tall); avoid dense axes (see `charts.md`).
- Tables become cards or key-value lists; keep the 3-4 fields that matter in each row and put the rest in the detail screen.
- Filters in a sheet, with applied-filter chips under the header.

## Responsive and tablet

- Phones in portrait are the baseline. For tablets use two-pane layouts (list and detail) rather than stretching phone layouts.

## Mistakes

- Desktop screens shrunk to fit; hover-dependent interactions; tiny links.
- Five-level nested navigation; modals over modals.
- Asking for notification, location or camera permission at first launch with no context.
- Forms that lose input when the app backgrounds.
