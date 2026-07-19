import { describe, expect, it } from 'vitest';
import { getSiteKeys, parseDomainInput, resolveRule, ruleTargetFor } from '@/lib/domain';
import type { DomainRule } from '@/lib/types';

describe('getSiteKeys', () => {
  it('extracts hostname and registrable domain for a simple https url', () => {
    expect(getSiteKeys('https://www.github.com/anthropics/claude-code')).toEqual({
      hostname: 'www.github.com',
      registrable: 'github.com',
    });
  });

  it('resolves multi-part public suffixes (co.uk) to the correct eTLD+1', () => {
    expect(getSiteKeys('https://shop.tesco.co.uk/groceries')).toEqual({
      hostname: 'shop.tesco.co.uk',
      registrable: 'tesco.co.uk',
    });
  });

  it('treats a private-suffix host like github.io as its own registrable domain', () => {
    // github.io is on the public suffix list, so "someuser.github.io" IS the
    // registrable domain, not "github.io" itself. Getting this wrong would
    // let a rule for one github.io user's site leak to every other one.
    expect(getSiteKeys('https://someuser.github.io/repo')).toEqual({
      hostname: 'someuser.github.io',
      registrable: 'someuser.github.io',
    });
  });

  it('falls back to hostname-only for localhost (no registrable domain)', () => {
    expect(getSiteKeys('http://localhost:3000/app')).toEqual({
      hostname: 'localhost',
      registrable: null,
    });
  });

  it('falls back to hostname-only for bare IP addresses', () => {
    expect(getSiteKeys('http://192.168.1.1:8080/')).toEqual({
      hostname: '192.168.1.1',
      registrable: null,
    });
  });

  it('returns null for internal browser pages (no manageable site)', () => {
    expect(getSiteKeys('chrome://extensions/')).toBeNull();
    expect(getSiteKeys('chrome-extension://abcdefg/options.html')).toBeNull();
    expect(getSiteKeys('about:blank')).toBeNull();
    expect(getSiteKeys('edge://settings/')).toBeNull();
  });

  it('returns null for malformed urls', () => {
    expect(getSiteKeys('not a url')).toBeNull();
    expect(getSiteKeys('')).toBeNull();
  });

  it('supports file:// urls using the hostname (usually empty -> falls back safely)', () => {
    // file:// URLs have no hostname in the common case; we should not manage them
    // by mistake with an empty-string key.
    expect(getSiteKeys('file:///C:/Users/test.html')).toBeNull();
  });
});

describe('resolveRule', () => {
  const exactRule: DomainRule = {
    key: 'mail.google.com',
    exact: true,
    extensionIds: ['ext-a'],
    updatedAt: 1,
  };
  const domainRule: DomainRule = {
    key: 'google.com',
    exact: false,
    extensionIds: ['ext-b'],
    updatedAt: 1,
  };

  it('prefers an exact hostname rule over a registrable-domain rule', () => {
    const rules = { [exactRule.key]: exactRule, [domainRule.key]: domainRule };
    const resolved = resolveRule(rules, { hostname: 'mail.google.com', registrable: 'google.com' });
    expect(resolved).toBe(exactRule);
  });

  it('falls back to the registrable-domain rule when no exact rule exists', () => {
    const rules = { [domainRule.key]: domainRule };
    const resolved = resolveRule(rules, { hostname: 'drive.google.com', registrable: 'google.com' });
    expect(resolved).toBe(domainRule);
  });

  it('returns undefined when no rule matches either key', () => {
    const resolved = resolveRule({}, { hostname: 'example.com', registrable: 'example.com' });
    expect(resolved).toBeUndefined();
  });

  it('does not let a domain-level rule masquerade as an exact match', () => {
    // A rule stored under the same string as the hostname but with exact:false
    // (e.g. visiting the bare registrable domain itself) should still be found
    // via the registrable-domain branch.
    const bareRule: DomainRule = { key: 'example.com', exact: false, extensionIds: [], updatedAt: 1 };
    const resolved = resolveRule({ 'example.com': bareRule }, { hostname: 'example.com', registrable: 'example.com' });
    expect(resolved).toBe(bareRule);
  });
});

describe('parseDomainInput', () => {
  it('accepts a bare domain with no scheme', () => {
    expect(parseDomainInput('example.com')).toEqual({ hostname: 'example.com', registrable: 'example.com' });
  });

  it('accepts a bare subdomain', () => {
    expect(parseDomainInput('mail.example.com')).toEqual({ hostname: 'mail.example.com', registrable: 'example.com' });
  });

  it('lowercases input', () => {
    expect(parseDomainInput('Mail.Example.COM')).toEqual({ hostname: 'mail.example.com', registrable: 'example.com' });
  });

  it('accepts a full URL with scheme and path, ignoring the path', () => {
    expect(parseDomainInput('https://example.com/some/path?x=1')).toEqual({
      hostname: 'example.com',
      registrable: 'example.com',
    });
  });

  it('accepts localhost', () => {
    expect(parseDomainInput('localhost')).toEqual({ hostname: 'localhost', registrable: null });
  });

  it('accepts a bare IP address', () => {
    expect(parseDomainInput('192.168.1.1')).toEqual({ hostname: '192.168.1.1', registrable: null });
  });

  it('rejects empty or whitespace-only input', () => {
    expect(parseDomainInput('')).toBeNull();
    expect(parseDomainInput('   ')).toBeNull();
  });

  it('rejects input with no dot that is not localhost or an IP', () => {
    expect(parseDomainInput('notadomain')).toBeNull();
  });

  it('rejects input containing spaces', () => {
    expect(parseDomainInput('example .com')).toBeNull();
  });
});

describe('ruleTargetFor', () => {
  it('targets the exact hostname when granularity is "hostname"', () => {
    expect(ruleTargetFor({ hostname: 'mail.google.com', registrable: 'google.com' }, 'hostname')).toEqual({
      key: 'mail.google.com',
      exact: true,
    });
  });

  it('targets the registrable domain when granularity is "registrable"', () => {
    expect(ruleTargetFor({ hostname: 'mail.google.com', registrable: 'google.com' }, 'registrable')).toEqual({
      key: 'google.com',
      exact: false,
    });
  });

  it('falls back to exact hostname when no registrable domain exists (localhost/IP)', () => {
    expect(ruleTargetFor({ hostname: 'localhost', registrable: null }, 'registrable')).toEqual({
      key: 'localhost',
      exact: true,
    });
  });
});
