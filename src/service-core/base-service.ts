import type { Subscription } from 'rxjs';

export abstract class BaseService {
  private readonly subscriptions: Subscription[] = [];
  private bound = false;

  protected own(subscription: Subscription): Subscription {
    this.subscriptions.push(subscription);
    return subscription;
  }

  bind(): void {
    if (this.bound) return;
    this.bound = true;
    try {
      this.onBind();
    } catch (error) {
      this.unbind();
      throw error;
    }
  }

  unbind(): void {
    if (!this.bound) return;
    this.bound = false;
    this.subscriptions.splice(0).forEach((subscription) => subscription.unsubscribe());
    this.onUnbind();
  }

  protected onBind(): void {}

  protected onUnbind(): void {}
}
