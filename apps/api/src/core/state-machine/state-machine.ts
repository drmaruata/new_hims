import { ConflictException } from '@nestjs/common';

/**
 * Declarative finite state machine shared by the clinical and financial
 * aggregates (SRS Appendix B).
 *
 * Transitions live here rather than in scattered `if` statements so that:
 *   - an illegal transition is a 409 with the legal alternatives named, which
 *     is what API_CONTRACT §6 requires for a state conflict;
 *   - the same state graph is reusable by the web and mobile clients.
 */
export interface Transition<S extends string, E extends string> {
  /** The action a caller requests, e.g. `sign` or `complete`. */
  event: E;
  from: readonly S[];
  to: S;
  /** Side effect run as part of the same transaction as the state change. */
  onTransition?: () => Promise<void>;
}

export class StateMachine<S extends string, E extends string> {
  constructor(
    private readonly name: string,
    private readonly transitions: ReadonlyArray<Transition<S, E>>,
  ) {}

  /** Events accepted from a given state. */
  allowedEvents(state: S): E[] {
    return this.transitions
      .filter((t) => t.from.includes(state))
      .map((t) => t.event);
  }

  canTransition(state: S, event: E): boolean {
    return this.transitions.some((t) => t.event === event && t.from.includes(state));
  }

  /**
   * Resolve the target state or raise 409.
   *
   * 409 rather than 400: the request was well-formed but conflicts with the
   * resource's current state, which is exactly the contract's definition of
   * "state or concurrency conflict".
   */
  next(state: S, event: E): S {
    const transition = this.transitions.find(
      (t) => t.event === event && t.from.includes(state),
    );

    if (!transition) {
      const legal = this.allowedEvents(state);
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot ${event} a ${this.name} in state ${state}`,
        details: [
          {
            field: 'state',
            message:
              legal.length > 0
                ? `Allowed from ${state}: ${legal.join(', ')}`
                : `${state} is a terminal state`,
          },
        ],
      });
    }

    return transition.to;
  }
}
