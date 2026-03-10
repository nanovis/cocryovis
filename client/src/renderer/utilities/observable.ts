export class Observable<T> {
  private listeners = new Set<(value: T) => void>();
  private scheduled = false;

  constructor(private getValue: () => T) {}

  observe(listener: (value: T) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  unobserve(listener: (value: T) => void) {
    this.listeners.delete(listener);
  }

  notify() {
    if (this.scheduled) return;
    this.scheduled = true;

    queueMicrotask(() => {
      this.scheduled = false;

      const value = this.getValue();
      for (const listener of this.listeners) {
        listener(value);
      }
    });
  }
}
