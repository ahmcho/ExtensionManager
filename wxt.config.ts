import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Extension Manager',
    description: 'Enable and disable your other extensions per site.',
    version: '0.1.0',
    permissions: [
      // Required to call browser.management.getAll()/setEnabled() on OTHER
      // installed extensions. This is the core capability of the tool and
      // triggers Chrome's "Manage your apps, extensions, and themes" install
      // warning -- there is no narrower permission that grants this.
      'management',
      // Required to read the active tab's URL on navigation/tab-switch so we
      // can compute which domain rule applies and whether the badge should
      // show a pending-change count. We deliberately do NOT request any
      // host_permissions -- we never read page content, only tab.url.
      'tabs',
      // Rules and always-on pins, stored locally (see PRIVACY.md).
      'storage',
    ],
    // open_in_tab is set via a <meta name="manifest.open_in_tab"> tag in
    // entrypoints/options/index.html -- the rules/backup UI needs a full tab,
    // not the cramped embedded dialog Chrome uses by default.
  },
});
