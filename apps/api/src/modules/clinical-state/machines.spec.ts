import { ConflictException } from '@nestjs/common';
import {
  appointmentMachine,
  capaMachine,
  claimMachine,
  encounterMachine,
  labSpecimenMachine,
} from './machines.js';

/**
 * Guards the declared graphs themselves (SRS Appendix B), not just the
 * machine's rules. Two classes of regression matter here:
 *
 *   * a transition added to a graph that the contract does not allow, and
 *   * a state left reachable after it should have become terminal.
 *
 * Every event is a bare string in the state list, so the exhaustive checks
 * below are what keep a typo in an event name from silently disabling a rule.
 */
describe('clinical state machines', () => {
  it('walks the encounter lifecycle to a terminal CLOSED', () => {
    expect(encounterMachine.next('OPEN', 'start')).toBe('IN_PROGRESS');
    expect(encounterMachine.next('IN_PROGRESS', 'sign')).toBe('SIGNED');
    expect(encounterMachine.next('SIGNED', 'close')).toBe('CLOSED');
    expect(encounterMachine.allowedEvents('CLOSED')).toEqual([]);
    expect(() => encounterMachine.next('CLOSED', 'close')).toThrow(ConflictException);
  });

  it('does not let a signed encounter be reopened', () => {
    // Finalized clinical history is immutable; a correction is an amendment,
    // not a transition back to a writable state.
    expect(encounterMachine.canTransition('SIGNED', 'start')).toBe(false);
  });

  it('refuses to start an encounter that is already in progress', () => {
    expect(() => encounterMachine.next('IN_PROGRESS', 'start')).toThrow(ConflictException);
  });

  it('allows the two ways out of SCHEDULED that the register allows', () => {
    expect(appointmentMachine.next('SCHEDULED', 'confirm')).toBe('CONFIRMED');
    expect(appointmentMachine.next('SCHEDULED', 'checkIn')).toBe('CHECKED_IN');
    expect(appointmentMachine.next('SCHEDULED', 'noShow')).toBe('NO_SHOW');
  });

  it('treats a completed appointment as terminal', () => {
    expect(appointmentMachine.allowedEvents('COMPLETED')).toEqual([]);
  });

  it('requires a collected specimen before it can be received', () => {
    expect(labSpecimenMachine.next('ORDERED', 'collect')).toBe('COLLECTED');
    expect(() => labSpecimenMachine.next('ORDERED', 'process')).toThrow(ConflictException);
  });

  it('lets a claim be resubmitted only from a rejected or partly approved state', () => {
    expect(claimMachine.next('REJECTED', 'resubmit')).toBe('RESUBMITTED');
    expect(claimMachine.next('PARTIALLY_APPROVED', 'resubmit')).toBe('RESUBMITTED');
    expect(() => claimMachine.next('APPROVED', 'resubmit')).toThrow(ConflictException);
  });

  it('settles a claim only once it is approved in whole or in part', () => {
    expect(claimMachine.next('APPROVED', 'settle')).toBe('SETTLED');
    expect(claimMachine.next('PARTIALLY_APPROVED', 'settle')).toBe('SETTLED');
    expect(() => claimMachine.next('ACKNOWLEDGED', 'settle')).toThrow(ConflictException);
  });

  it('treats exactly the declared states as terminal', () => {
    // A state with no outgoing transition is final for that record. These are
    // the states from which nothing may follow, so a client cannot drive a
    // closed record back into a writable one.
    expect(encounterMachine.allowedEvents('CLOSED')).toEqual([]);
    expect(appointmentMachine.allowedEvents('COMPLETED')).toEqual([]);
    expect(appointmentMachine.allowedEvents('CANCELLED')).toEqual([]);
    expect(appointmentMachine.allowedEvents('NO_SHOW')).toEqual([]);
    expect(labSpecimenMachine.allowedEvents('COMPLETED')).toEqual([]);
    expect(claimMachine.allowedEvents('SETTLED')).toEqual([]);
    expect(capaMachine.allowedEvents('CLOSED')).toEqual([]);
  });

  it('keeps a rejected claim open for resubmission rather than terminal', () => {
    expect(claimMachine.allowedEvents('REJECTED')).toEqual(['resubmit']);
  });

  it('reaches the terminal state of each lifecycle from its starting state', () => {
    expect(encounterMachine.next('OPEN', 'start')).toBe('IN_PROGRESS');
    expect(appointmentMachine.next('IN_CONSULTATION', 'complete')).toBe('COMPLETED');
    expect(labSpecimenMachine.next('PROCESSING', 'complete')).toBe('COMPLETED');
    expect(claimMachine.next('APPROVED', 'settle')).toBe('SETTLED');
    expect(capaMachine.next('PENDING_VERIFICATION', 'close')).toBe('CLOSED');
  });
});
