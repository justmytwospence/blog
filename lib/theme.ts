/**
 * The decision behind the two-state theme toggle, kept here as pure logic so it can be tested
 * without a DOM. See components/ThemeToggle.tsx for the UI and the reasoning.
 */

/** What the page currently looks like. The stored setting has a third value; this never does. */
export type Appearance = 'light' | 'dark';

/** The three-state model behind the two-state control. `system` means "follow the OS". */
export type ThemeSetting = Appearance | 'system';

/**
 * The setting a click should store, given what is on screen right now and what the OS asks for.
 *
 * Two rules, both from Lea Verou's "Dark mode toggles should be two-state"
 * (https://lea.verou.me/blog/2026/dark-mode-toggles/):
 *
 *  - A click targets the OPPOSITE of what is currently on screen. That is the whole user goal: the
 *    page is too bright or too dark right now, and they want the other one.
 *  - If that target is what the OS already asks for, store `system` rather than pinning the literal
 *    value. Pinning a value that merely happens to agree with the OS is what makes a bad two-state
 *    toggle irreversible — it quietly turns a momentary adjustment into a permanent override with
 *    no way back to following the OS.
 *
 * Note what this function does NOT do: it is never called except on a click. An override is never
 * reconciled against the OS in the background, so a theme pinned by the user survives an OS that
 * switches on a schedule.
 *
 * `systemPreference` may be undefined before the theme provider has resolved it; a click then pins
 * the target, which is the safe direction (an unwanted pin costs one more click to undo, whereas
 * wrongly clearing an override cannot be noticed at all).
 */
export function nextThemeSetting(
  onScreen: Appearance,
  systemPreference: Appearance | undefined,
): ThemeSetting {
  const target: Appearance = onScreen === 'dark' ? 'light' : 'dark';
  return target === systemPreference ? 'system' : target;
}
