import { describe, expect, it } from 'vitest';
import { shouldReloadComplianceDataBeforeClose } from './complianceModalPostSuccess';

describe('shouldReloadComplianceDataBeforeClose', () => {
  it('ne recharge pas la modale avant fermeture (anti-flash spinner)', () => {
    expect(shouldReloadComplianceDataBeforeClose()).toBe(false);
  });
});
