import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { config } from './config.js';
import type { HostUser } from './users.js';

/**
 * Mints the identity token the portal exchanges for an embedded session.
 * Rules (checked by Console when the portal exchanges the token; see the portal's Embed tab and the embed documentation):
 *  - alg is exactly the one pinned in the Embed tab (HS256 here); `kid` names the secret (required while two are active)
 *  - iss  = the Issuer from the Embed tab, compared as text
 *  - aud  = cognipeer-portal:<portal key>  (or cognipeer-portal:<workspace slug>:<portal key>)
 *  - sub  = the person's id in your system (1..512 chars)
 *  - iat/exp in seconds; exp - iat <= the portal's "Longest token lifetime" (default 300, max 600)
 *  - jti  = a fresh unique id per token: a token works ONCE (second exchange -> token_replayed)
 *  - the whole token is at most 8192 characters
 */
export async function mintToken(user: HostUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const aud = config.requireWorkspaceAud
    ? `cognipeer-portal:${config.tenant}:${config.portal}`
    : `cognipeer-portal:${config.portal}`;

  return new SignJWT({
    email: user.email,
    // Only claim this when you really verified the address: the default identity mapping
    // finds a Console member by verified email.
    email_verified: user.emailVerified,
    name: user.name,
    groups: user.groups, // always an array of strings, even for one group
    // `ctx` is delivered to the agent as run context. You vouch for it; Console never uses it to decide access. Max 4 KB.
    ctx: { plan: user.plan },
  })
    .setProtectedHeader({ alg: 'HS256', kid: config.keyId })
    .setIssuer(config.issuer)
    .setAudience(aud)
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + 120)
    .setJti(randomUUID())
    .sign(config.secret);
}
