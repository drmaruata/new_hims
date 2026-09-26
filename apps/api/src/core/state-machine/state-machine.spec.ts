import { ConflictException } from '@nestjs/common';
import { StateMachine } from './state-machine.js';

/**
 * The state graphs live in `modules/clinical-state/machines.ts` and are the
 * declared contract (SRS Appendix B). These cases pin the *rules* on the
 * machine itself; the graphs are imported by
 * `clinical-state/machines.spec.ts`.
 */
describe('StateMachine', () => {
  const machine = new StateMachine<'OPEN' | 'IN_PROGRESS' | 'SIGNED' | 'CLOSED', string>(
    'encounter',
    [
      { event: 'start', from: ['OPEN'], to: 'IN_PROGRESS' },
      { event: 'sign', from: ['IN_PROGRESS'], to: 'SIGNED' },
      { event: 'close', from: ['SIGNED'], to: 'CLOSED' },
    ]
  );

  describe('allowedEvents', () => {
    it('lists only the events reachable from the current state', () => {
      expect(machine.allowedEvents('OPEN')).toEqual(['start']);
      expect(machine.allowedEvents('IN_PROGRESS')).toEqual(['sign']);
    });

    it('reports nothing for a terminal state, so it needs no special case', () => {
      expect(machine.allowedEvents('CLOSED')).toEqual([]);
    });
  });

  describe('canTransition', () => {
    it('accepts a declared transition', () => {
      expect(machine.canTransition('OPEN', 'start')).toBe(true);
    });

    it('rejects a declared event that is not reachable from the current state', () => {
      expect(machine.canTransition('OPEN', 'sign')).toBe(false);
    });

    it('rejects an unknown event outright', () => {
      expect(machine.canTransition('OPEN', 'resurrect')).toBe(false);
    });
  });

  describe('next', () => {
    it('resolves the target state for a legal transition', () => {
      expect(machine.next('OPEN', 'start')).toBe('IN_PROGRESS');
      expect(machine.next('IN_PROGRESS', 'sign')).toBe('SIGNED');
    });

    /**
     * 409 rather than 400: the request was well-formed but conflicts with the
     * resource's current state, which is API_CONTRACT §6's definition of a
     * state or concurrency conflict.
     */
    it('raises 409 with the legal alternatives named', () => {
      expect(() => machine.next('OPEN', 'sign')).toThrow(ConflictException);

      try {
        machine.next('OPEN', 'sign');
        throw new Error('expected the transition to be rejected');
      } catch (thrown) {
        expect(thrown).toBeInstanceOf(ConflictException);
        const response = (thrown as ConflictException).getResponse() as {
          code: string;
          message: string;
          details: Array<{ field: string; message: string }>;
        };
        expect(response.code).toBe('INVALID_STATE_TRANSITION');
        expect(response.message).toBe('Cannot sign an encounter in state OPEN');
        expect(response.details).toEqual([{ field: 'state', message: 'Allowed from OPEN: start' }]);
      }
    });

    /**
     * The article is chosen from the aggregate name, so a name starting with a
     * vowel must not inherit the "a encounter" wording the fixed template
     * produced.
     */
    it.each([
      ['encounter', 'an encounter'],
      ['appointment', 'an appointment'],
      ['claim', 'a claim'],
      ['CAPA', 'a CAPA'],
      ['lab specimen', 'a lab specimen'],
    ])('reads naturally for the %s aggregate', (name, expected) => {
      const named = new StateMachine<string, string>(name, []);

      try {
        named.next('OPEN', 'sign');
        throw new Error('expected the transition to be rejected');
      } catch (thrown) {
        const response = (thrown as ConflictException).getResponse() as { message: string };
        expect(response.message).toBe(`Cannot sign ${expected} in state OPEN`);
      }
    });

    it('says so explicitly when the state is terminal', () => {
      try {
        machine.next('CLOSED', 'close');
        throw new Error('expected the transition to be rejected');
      } catch (thrown) {
        const response = (thrown as ConflictException).getResponse() as {
          details: Array<{ field: string; message: string }>;
        };
        expect(response.details).toEqual([
          { field: 'state', message: 'CLOSED is a terminal state' },
        ]);
      }
    });
  });
});
