export type Unsubscribe = () => void;

export class EventBus<TEvent> {
  private readonly listeners = new Set<(event: TEvent) => void>();

  publish(event: TEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: (event: TEvent) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}