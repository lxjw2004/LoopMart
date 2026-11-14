import { defineTheme } from '@astryxdesign/core/theme';
import { widthBreakpoints } from '../breakpoints.js';
import { loopmartWebTheme } from '../loopmart-web/loopmartWebTheme.js';

export const loopmartAdminTheme = defineTheme({
  name: 'loopmart-admin', extends: loopmartWebTheme,
  tokens: {
    '--text-body-size': '14px', '--text-body-leading': '1.5', '--text-label-size': '12px',
    '--text-supporting-size': '12px', '--text-heading-1-size': '25px', '--text-heading-1-weight': '650',
    '--text-heading-2-size': '22px', '--text-heading-2-weight': '600',
    '--text-display-3-size': '30px', '--text-display-3-weight': '550',
    '--radius-element': '8px', '--radius-container': '12px', '--size-element-sm': '32px', '--size-element-md': '36px',
    '--focus-outline-width': '2px',
  },
  localTokens: {
    '--lm-control-font': '13px',
    '--lm-control-height': '38px', '--lm-button-padding': '7px 12px', '--lm-button-weight': '500',
    '--lm-form-padding': '24px',
  },
  adaptations: { widthBreakpoints: { ...widthBreakpoints, lg: 1024 }, rules: [{ when: { width: { below: 'md' } }, value: { tokens: { '--text-heading-1-size': '23px' }, localTokens: { '--lm-control-font': '16px', '--lm-control-height': '44px', '--lm-form-padding': '22px', '--lm-form-group-padding': '18px' }, components: { 'app-shell-header': { base: { display: 'block' } }, 'app-shell-sidenav': { base: { display: 'none' } } } } }] },
  components: {
    'app-shell-header': { base: { display: 'none' } },
    'top-nav': { base: { backgroundColor: 'var(--lm-admin-nav-background)' } },
    'side-nav-heading': { base: { color: 'var(--color-accent)', fontSize: '22px', fontWeight: '750', letterSpacing: '-0.03em', '--text-large-size': '22px', '--text-large-weight': '750' } },
    'top-nav-heading': { base: { color: 'var(--color-accent)', fontSize: '21px', fontWeight: '750', letterSpacing: '-0.03em', '--text-large-size': '21px', '--text-large-weight': '750' } },
    card: {
      base: { padding: '22px' },
      'variant:admin-record': { backgroundColor: 'var(--color-background-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', padding: '18px' },
    },
    section: {
      'variant:admin-table': { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', backgroundColor: 'var(--color-background-surface)', padding: '0px', overflow: 'hidden' },
      'variant:admin-detail': { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)', backgroundColor: 'var(--color-background-surface)', padding: 'var(--lm-admin-detail-padding)' },
      'variant:admin-summary': { borderRadius: 'var(--radius-element)', backgroundColor: 'var(--color-background-muted)', color: 'var(--color-text-secondary)', padding: '14px' },
    },
    token: {
      'color:admin-status': { backgroundColor: 'var(--color-background-muted)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '11px', borderRadius: '4px' },
      'color:admin-brand': { backgroundColor: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '10px', borderRadius: '4px', padding: '2px 5px' },
    },
    text: {
      'type:admin-nav-index': { fontSize: '10px', color: 'var(--lm-admin-subtle)', fontVariantNumeric: 'tabular-nums' },
      'type:admin-eyebrow': { fontSize: '11px', color: 'var(--lm-admin-subtle)' },
      'type:admin-detail-label': { fontSize: '11px', color: 'var(--lm-admin-subtle)' },
    },
    'table-header-cell': { base: { backgroundColor: 'var(--color-background-muted)', color: 'var(--color-text-secondary)', fontSize: '11px', fontWeight: '500', padding: '13px 18px' } },
    'table-cell': { base: { fontSize: '12px', padding: '17px 18px', borderColor: 'var(--color-border)' } },
    'table-row': { base: { backgroundColor: 'var(--color-background-surface)' } },
    'table-scroll-wrapper': { base: { borderRadius: 'var(--radius-container)', backgroundColor: 'var(--color-background-surface)' } },
  },
});
