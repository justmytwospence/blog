import { describe, it, expect } from 'vitest';
import { nextThemeSetting, type Appearance, type ThemeSetting } from '../theme';

/**
 * The two-state toggle has to reach all three stored states, and — the part that is easy to get
 * wrong — has to leave an explicit override alone when the OS drifts into agreeing with it.
 */
describe('nextThemeSetting', () => {
  it('always targets the opposite of what is on screen', () => {
    // OS set to whatever is already on screen, so neither case can be answered by "match the OS".
    expect(nextThemeSetting('light', 'light')).toBe('dark');
    expect(nextThemeSetting('dark', 'dark')).toBe('light');
  });

  it('pins an override when the target differs from the OS', () => {
    expect(nextThemeSetting('light', 'light')).toBe('dark');
    expect(nextThemeSetting('dark', 'dark')).toBe('light');
  });

  it('drops the override instead of pinning it when the target matches the OS', () => {
    // Reading dark while the OS says light means an override is active; toggling back to light must
    // restore "follow the OS" rather than storing `light`, or the OS can never be followed again.
    expect(nextThemeSetting('dark', 'light')).toBe('system');
    expect(nextThemeSetting('light', 'dark')).toBe('system');
  });

  it('pins the target when the system preference is not known yet', () => {
    expect(nextThemeSetting('light', undefined)).toBe('dark');
    expect(nextThemeSetting('dark', undefined)).toBe('light');
  });

  /**
   * The scenario from the article, driven end to end. `onScreen` is derived the way the provider
   * derives it — an override wins, otherwise the OS decides — and the OS is moved between clicks
   * WITHOUT calling nextThemeSetting, because that evaluation only ever happens on a click.
   */
  it('keeps a pinned override across an OS that switches on a schedule', () => {
    let stored: ThemeSetting = 'system';
    let os: Appearance = 'light';
    const onScreen = (): Appearance => (stored === 'system' ? os : stored);
    const click = () => {
      stored = nextThemeSetting(onScreen(), os);
    };

    // 1. Nothing stored, OS light: the page follows the OS.
    expect(onScreen()).toBe('light');

    // 2. A click targets dark, which is not the OS, so it is pinned.
    click();
    expect(stored).toBe('dark');
    expect(onScreen()).toBe('dark');

    // 3. The OS switches to dark on its own. The override now agrees with it — and is kept.
    os = 'dark';
    expect(stored).toBe('dark');
    expect(onScreen()).toBe('dark');

    // 4. The OS switches back to light. The page stays dark, because the override is still active.
    os = 'light';
    expect(stored).toBe('dark');
    expect(onScreen()).toBe('dark');

    // 5. A click targets light, which IS the OS, so the override is dropped.
    click();
    expect(stored).toBe('system');
    expect(onScreen()).toBe('light');

    // 6. The OS switches to dark; with nothing pinned, the page follows again.
    os = 'dark';
    expect(onScreen()).toBe('dark');
  });

  it('needs at most one extra click to pin a theme that started out matching the OS', () => {
    // The one rough edge the article concedes: meaning to pin `light` while the OS is already light
    // gets you "follow the OS" instead. It can only bite once, and one click fixes it for good.
    let stored: ThemeSetting = 'system';
    let os: Appearance = 'light';
    const onScreen = (): Appearance => (stored === 'system' ? os : stored);

    stored = nextThemeSetting(onScreen(), os); // -> dark (pinned)
    stored = nextThemeSetting(onScreen(), os); // meant to pin light; drops to system
    expect(stored).toBe('system');

    os = 'dark'; // the OS moves and the page follows, which is not what was meant
    expect(onScreen()).toBe('dark');

    stored = nextThemeSetting(onScreen(), os); // light no longer matches the OS, so now it pins
    expect(stored).toBe('light');
    os = 'light';
    expect(stored).toBe('light'); // and survives the OS coming back around
  });
});
