import { defineTheme } from '@astryxdesign/core/theme';
import { widthBreakpoints } from '../breakpoints.js';
import { loopmartWebTheme } from '../loopmart-web/loopmartWebTheme.js';

export const loopmartAdminTheme = defineTheme({
  name: 'loopmart-admin', extends: loopmartWebTheme,
  tokens: {
    '--color-accent': '#3d6058', '--color-accent-muted': '#edf2ed', '--color-neutral': '#edf2ed',
    '--color-background-body': '#f7f8f5', '--color-background-surface': '#ffffff',
    '--color-text-primary': '#29332f', '--color-text-secondary': '#747b76', '--color-text-accent': '#3d6058',
    '--color-icon-primary': '#29332f', '--color-icon-secondary': '#747b76', '--color-icon-accent': '#3d6058',
    '--color-border': '#e3e6e1', '--color-border-emphasized': '#dce2d7', '--color-background-muted': '#f5f7f0',
    '--color-error': '#a3483d', '--color-text-error': '#a3483d', '--color-error-muted': '#fbefeb',
    '--color-on-error-muted': '#a3483d', '--color-overlay': '#23312255',
    '--text-body-size': '14px', '--text-body-leading': '1.5', '--text-label-size': '12px',
    '--text-supporting-size': '12px', '--text-heading-1-size': '25px', '--text-heading-1-weight': '650',
    '--text-heading-2-size': '22px', '--text-heading-2-weight': '600',
    '--text-display-3-size': '30px', '--text-display-3-weight': '550',
    '--radius-element': '6px', '--radius-container': '9px', '--size-element-sm': '32px', '--size-element-md': '36px',
    '--focus-outline-width': '2px', '--focus-outline-color': '#8fa99c',
  },
  localTokens: {
    '--lm-accent-hover': '#304e47', '--lm-control-font': '13px', '--lm-control-border': '#dce2d7',
    '--lm-control-height': '38px', '--lm-label-color': '#576052', '--lm-button-padding': '7px 12px', '--lm-button-weight': '500',
    '--lm-form-padding': '24px',
  },
  adaptations: { widthBreakpoints, rules: [{ when: { width: { below: 'md' } }, value: { tokens: { '--text-heading-1-size': '23px' }, localTokens: { '--lm-form-padding': '22px', '--lm-form-group-padding': '18px' }, components: { 'app-shell-header': { base: { display: 'block' } }, 'app-shell-sidenav': { base: { display: 'none' } } } } }] },
  components: {
    'app-shell-header': { base: { display: 'none' } },
    'top-nav': { base: { backgroundColor: 'var(--lm-admin-nav-background)' } },
    'side-nav-heading': { base: { color: '#293a31', fontSize: '22px', fontWeight: '750', letterSpacing: '-0.9px', '--text-large-size': '22px', '--text-large-weight': '750' } },
    'top-nav-heading': { base: { color: '#293a31', fontSize: '21px', fontWeight: '750', letterSpacing: '-0.9px', '--text-large-size': '21px', '--text-large-weight': '750' } },
    card: {
      base: { padding: '22px' },
      'variant:admin-record': { backgroundColor: '#ffffff', border: '1px solid #e3e6e1', borderRadius: '9px', padding: '18px' },
    },
    section: {
      'variant:admin-table': { border: '1px solid #e3e6e1', borderRadius: '9px', backgroundColor: '#ffffff', padding: '0px', overflow: 'hidden' },
      'variant:admin-detail': { border: '1px solid #e3e6e1', borderRadius: '10px', backgroundColor: '#ffffff', padding: 'var(--lm-admin-detail-padding)' },
      'variant:admin-summary': { borderRadius: '7px', backgroundColor: '#f5f7f0', color: '#75816c', padding: '14px' },
    },
    token: {
      'color:admin-status': { backgroundColor: '#f1f4ed', border: '1px solid #e1e7d9', color: '#6a7d5b', fontSize: '11px', borderRadius: '4px' },
      'color:admin-brand': { backgroundColor: 'transparent', border: '1px solid #e2e6de', color: '#8a938a', fontSize: '10px', borderRadius: '4px', padding: '2px 5px' },
    },
    text: {
      'type:admin-nav-index': { fontSize: '10px', opacity: '0.55', fontVariantNumeric: 'tabular-nums' },
      'type:admin-eyebrow': { fontSize: '11px', color: '#8a9383' },
      'type:admin-detail-label': { fontSize: '11px', color: '#8a9383' },
    },
    'table-header-cell': { base: { backgroundColor: '#f4f6f0', color: '#7b8574', fontSize: '11px', fontWeight: '500', padding: '13px 18px' } },
    'table-cell': { base: { fontSize: '12px', padding: '17px 18px', borderColor: '#edf0e9' } },
    'table-row': { base: { backgroundColor: '#ffffff' } },
    'table-scroll-wrapper': { base: { borderRadius: '9px', backgroundColor: '#ffffff' } },
  },
});
