declare module 'plotly.js-dist-min' {
  export function newPlot(
    root: HTMLElement,
    data: any,
    layout?: any,
    config?: any
  ): Promise<void>;

  export function react(
    root: HTMLElement,
    data: any,
    layout?: any,
    config?: any
  ): Promise<void>;

  export function purge(root: HTMLElement): void;
}
