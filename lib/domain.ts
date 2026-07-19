import { getDomain } from 'tldts';
import type { DomainRule } from './types';

/** The two keys a site can be matched on, most specific first. */
export interface SiteKeys {
  /** Full hostname, e.g. "mail.google.com". Also used verbatim for localhost/IPs. */
  hostname: string;
  /** Registrable domain (eTLD+1), e.g. "google.com". Null when tldts can't derive one
   *  (localhost, bare IP addresses, single-label hosts) — in that case hostname is the
   *  only usable key. */
  registrable: string | null;
}

const MANAGEABLE_SCHEMES = new Set(['http:', 'https:', 'file:']);

/**
 * Extracts site keys from a tab URL. Returns null for schemes we deliberately
 * don't manage (chrome://, chrome-extension://, about:, devtools://, etc.) —
 * there is no meaningful "site" to attach a rule to, and we never want this
 * tool reacting to internal browser pages.
 */
export function getSiteKeys(url: string): SiteKeys | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!MANAGEABLE_SCHEMES.has(parsed.protocol)) return null;
  if (!parsed.hostname) return null;

  // allowPrivateDomains: PSL-private entries like "github.io" or "vercel.app"
  // must split at the subdomain, or every github.io user would share one
  // "registrable domain" and leak rules onto each other's pages.
  const registrable = getDomain(parsed.hostname, { allowPrivateDomains: true });
  return { hostname: parsed.hostname, registrable };
}

/**
 * Resolves the rule that applies to a site, preferring an exact-hostname rule
 * over a registrable-domain rule (e.g. a rule for "mail.google.com" wins over
 * one for "google.com").
 */
export function resolveRule(
  rules: Record<string, DomainRule>,
  site: SiteKeys,
): DomainRule | undefined {
  const exact = rules[site.hostname];
  if (exact?.exact) return exact;

  if (site.registrable) {
    const domainRule = rules[site.registrable];
    if (domainRule && !domainRule.exact) return domainRule;
  }

  return undefined;
}

/**
 * Parses free-typed domain input (options page "add a rule" form) into site
 * keys, e.g. "Sub.Example.com" -> { hostname: "sub.example.com", registrable: "example.com" }.
 * Accepts a bare domain, with or without a scheme; rejects anything that
 * isn't a plausible hostname (spaces, missing dot on a non-localhost value, etc).
 */
export function parseDomainInput(input: string): SiteKeys | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  const site = getSiteKeys(withScheme);
  if (!site) return null;
  if (site.hostname !== 'localhost' && !site.hostname.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(site.hostname)) {
    return null;
  }
  return site;
}

/** The key + exact flag a newly-created rule should use for a given site and granularity. */
export function ruleTargetFor(site: SiteKeys, granularity: 'hostname' | 'registrable'): { key: string; exact: boolean } {
  if (granularity === 'hostname' || !site.registrable) {
    return { key: site.hostname, exact: true };
  }
  return { key: site.registrable, exact: false };
}
