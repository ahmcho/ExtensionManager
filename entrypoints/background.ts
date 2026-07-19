import { getSiteKeys, resolveRule } from '@/lib/domain';
import { computeDesiredState } from '@/lib/diff';
import { listManageableExtensions } from '@/lib/management';
import { alwaysOnItem, rulesItem } from '@/lib/storage';

/**
 * Background responsibilities are strictly read-only with respect to other
 * extensions: it computes what WOULD change for the active tab's site and
 * reflects that as a badge count, but never calls management.setEnabled
 * itself. That call requires a user gesture, and reacting to tab navigation
 * is not one -- see README "Why click-to-sync" for the full rationale.
 * The popup performs the actual apply, triggered by the click that opens it.
 */
async function refreshBadgeForTab(tabId: number, url: string | undefined): Promise<void> {
  if (!url) {
    await clearBadge(tabId);
    return;
  }

  const site = getSiteKeys(url);
  if (!site) {
    await clearBadge(tabId);
    return;
  }

  try {
    const [rules, alwaysOnIds, extensions] = await Promise.all([
      rulesItem.getValue(),
      alwaysOnItem.getValue(),
      listManageableExtensions(),
    ]);
    const rule = resolveRule(rules, site);
    const diff = computeDesiredState(extensions, rule, alwaysOnIds);

    if (diff.length === 0) {
      await clearBadge(tabId);
    } else {
      await browser.action.setBadgeText({ tabId, text: String(diff.length) });
      await browser.action.setBadgeBackgroundColor({ tabId, color: '#f59e0b' });
    }
  } catch {
    // Extension list can legitimately fail to enumerate mid-navigation; badge
    // just stays as it was. Never let this throw into the event listener.
  }
}

async function clearBadge(tabId: number): Promise<void> {
  await browser.action.setBadgeText({ tabId, text: '' });
}

export default defineBackground(() => {
  browser.tabs.onActivated.addListener(({ tabId }) => {
    browser.tabs.get(tabId).then((tab) => refreshBadgeForTab(tabId, tab.url));
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      refreshBadgeForTab(tabId, tab.url);
    }
  });

  // Installing/uninstalling/enabling/disabling any extension (including via
  // chrome://extensions directly) can change whether the active tab is in
  // sync, so recheck it.
  const recheckActiveTab = () => {
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id !== undefined) refreshBadgeForTab(tab.id, tab.url);
    });
  };
  browser.management.onEnabled.addListener(recheckActiveTab);
  browser.management.onDisabled.addListener(recheckActiveTab);
  browser.management.onInstalled.addListener(recheckActiveTab);
  browser.management.onUninstalled.addListener(recheckActiveTab);
  rulesItem.watch(recheckActiveTab);
  alwaysOnItem.watch(recheckActiveTab);
});
