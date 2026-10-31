import type { Subscription } from 'rxjs';

export abstract class BaseService {
  private readonly subscriptions: Subscription[] = [];
  private active = false;

  protected own(subscription: Subscription): Subscription {
    this.subscriptions.push(subscription);
    return subscription;
  }

  activate(): void {
    if (this.active) return;
    this.active = true;
    this.onActivate();
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    this.subscriptions.splice(0).forEach((subscription) => subscription.unsubscribe());
    this.onDeactivate();
  }

  protected onActivate(): void {}

  protected onDeactivate(): void {}

  destroy(): void {
    this.deactivate();
  }
}
