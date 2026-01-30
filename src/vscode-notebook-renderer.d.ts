declare module 'vscode-notebook-renderer' {
  interface OutputItem {
    readonly id: string;
    readonly mime: string;
    text(): string;
    json(): unknown;
    data(): Uint8Array;
  }

  interface RendererApi {
    setState(state: unknown): void;
    getState(): unknown;
  }

  interface RendererContext<TState = void> {
    readonly onDidChangeSettings: (callback: () => void) => void;
    readonly settings: { readonly lineLimit: number };
  }

  type ActivationFunction = (context: RendererContext) => {
    renderOutputItem(outputItem: OutputItem, element: HTMLElement): void;
    disposeOutputItem?(id: string): void;
  };
}
