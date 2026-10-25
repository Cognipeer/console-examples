// A fake user directory so the example runs without a real login system.
export interface HostUser {
  id: string; //            becomes the token's `sub`: stable id in YOUR system
  name: string;
  email: string;
  emailVerified: boolean; // true only if YOUR application has verified the address
  groups: string[];
  plan: string;
}

export const users: HostUser[] = [
  { id: 'u-1001', name: 'Ada Admin', email: 'ada@example.com', emailVerified: true, groups: ['support-agents', 'admins'], plan: 'enterprise' },
  { id: 'u-1002', name: 'Sam Support', email: 'sam@example.com', emailVerified: true, groups: ['support-agents'], plan: 'team' },
];
