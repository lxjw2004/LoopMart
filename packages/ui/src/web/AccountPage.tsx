"use client";

import type { CSSProperties, ReactNode } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Button } from '@astryxdesign/core/Button';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Section } from '@astryxdesign/core/Section';
import { Selector } from '@astryxdesign/core/Selector';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useLayout } from '../shared/design';
import ListingCard from './ListingCard';
import { errorText } from '../errors';
import type { AccountTab } from '../navigation';

type Row = Record<string, any>;
type Props = {
  selected: AccountTab;
  onTabChange: (tab: AccountTab) => void;
  emailForm: ReactNode;
  passwordForm: ReactNode;
  favoriteRows: Row[];
  favoriteBusy: boolean;
  favoriteError: unknown;
  favoriteIds: Set<string>;
  onFavoritesRetry: () => void;
  onFavorite: (row: Row) => void;
  onFavoriteOpen: (row: Row) => void;
  me: Row;
  english: boolean;
  t: (key: string) => string;
  profileForm: ReactNode;
  kind: string;
  rows: Row[];
  query: string;
  status: string;
  cursor: string | null;
  busy: boolean;
  onLogout: () => void;
  onContactAdmin: () => void;
  onKindChange: (kind: string) => void;
  onQueryChange: (query: string) => void;
  onStatusChange: (status: string) => void;
  onSearch: () => void;
  onMore: () => void;
  onOpen: (row: Row) => void;
  onPublish: () => void;
};

export default function AccountPage({selected, onTabChange, me, english, t, profileForm, emailForm, passwordForm, favoriteRows, favoriteBusy, favoriteError, favoriteIds, onFavoritesRetry, onFavorite, onFavoriteOpen, kind, rows, query, status, cursor, busy, onLogout, onContactAdmin, onKindChange, onQueryChange, onStatusChange, onSearch, onMore, onOpen, onPublish}: Props) {
  const { mobile, desktop } = useLayout();
  const say = (zh: string, en: string) => english ? en : zh;
  const navigation = [
    {id: 'profile', label: say('个人资料', 'Personal info'), icon: 'info'},
    {id: 'posts', label: say('我的发布', 'My posts'), icon: 'viewColumns'},
    {id: 'favorites', label: say('收藏', 'Saved items'), icon: 'checkDouble'},
    {id: 'change-password', label: say('修改密码', 'Change password'), icon: 'eyeSlash'},
  ] as const;
  const panelStyle = (tab: AccountTab): CSSProperties => ({minWidth: 0, display: selected === tab ? undefined : 'none'});

  return <Grid className="account-layout" gap={6} style={{gridTemplateColumns: desktop ? 'var(--lm-filter-width) minmax(0, 1fr)' : 'minmax(0, 1fr)', alignItems: 'start'}}>
    <Section className="account-nav" variant="form-panel" padding={5}>
      <VStack gap={4}>
        <Heading level={2} style={{fontSize: 'var(--text-heading-3-size)'}}>{say('账户中心', 'Account')}</Heading>
        <VStack as="nav" aria-label={say('账户菜单', 'Account menu')} gap={1}>
          {navigation.map(item => <Button key={item.id} label={item.label} variant="ghost" width="100%" icon={<Icon icon={item.icon} />}
            aria-current={selected === item.id ? 'location' : undefined}
            style={{justifyContent: 'flex-start', minHeight: 'var(--size-element-lg)', background: selected === item.id ? 'var(--color-accent-muted)' : 'transparent', color: selected === item.id ? 'var(--color-accent)' : 'var(--color-text-secondary)'}}
            onClick={() => onTabChange(item.id)} />)}
          <Divider />
          <Button label={say('退出登录', 'Sign out')} variant="ghost" width="100%" icon={<Icon icon="externalLink" />}
            style={{justifyContent: 'flex-start', minHeight: 'var(--size-element-lg)'}} onClick={onLogout} />
        </VStack>
      </VStack>
    </Section>

    <VStack className="account-content" gap={5} style={{minWidth: 0}}>
      <Section className="account-profile" variant="form-panel" padding={mobile ? 5 : 6} hidden={selected !== 'profile'} role="region" aria-labelledby="account-profile-heading" style={panelStyle('profile')}>
        <VStack gap={5}>
          <Heading level={2} id="account-profile-heading">{say('个人资料', 'Personal info')}</Heading>
          <Grid gap={6} style={{gridTemplateColumns: desktop ? 'minmax(0, 1fr) minmax(0, 2fr)' : 'minmax(0, 1fr)', alignItems: 'center'}}>
            <HStack gap={4} vAlign="center" style={{minWidth: 0}}>
              <Avatar name={String(me.name || '')} size={64} tooltip={false} />
              <VStack gap={2} style={{minWidth: 0}}>
                <Text weight="semibold" maxLines={2}>{me.name}</Text>
                <Button label={say('联系社区管理员', 'Contact admin')} variant="ghost" size="sm" width="fit-content" onClick={onContactAdmin} style={{paddingInline: 0, color: 'var(--color-accent)'}} />
              </VStack>
            </HStack>
            {profileForm}
          </Grid>
          <Divider />
          <VStack className="account-email" gap={5} role="region" aria-labelledby="account-email-heading">
            <Heading level={3} id="account-email-heading">{say('修改邮箱', 'Change email')}</Heading>
            <VStack width="100%" maxWidth="var(--lm-form-max)">{emailForm}</VStack>
          </VStack>
        </VStack>
      </Section>

      <Section className="account-posts" variant="form-panel" padding={mobile ? 5 : 6} hidden={selected !== 'posts'} role="region" aria-labelledby="account-posts-heading" style={panelStyle('posts')}>
        <VStack gap={5}>
          <Heading level={2} id="account-posts-heading">{say('发布管理', 'Post management')}</Heading>
          <TabList value={kind} onChange={onKindChange} role="tablist" aria-label={say('发布类型', 'Post type')} hasDivider>
            <Tab value="items" label={t('items')} panelId="account-posts-panel" style={{color: kind === 'items' ? 'var(--color-accent)' : 'var(--color-text-secondary)'}} />
            <Tab value="rides" label={t('rides')} panelId="account-posts-panel" style={{color: kind === 'rides' ? 'var(--color-accent)' : 'var(--color-text-secondary)'}} />
          </TabList>
          <VStack role="tabpanel" id="account-posts-panel" aria-label={t(kind)} gap={5} aria-busy={busy}>
            <HStack as="form" className="account-toolbar" gap={3} vAlign="end" wrap="wrap" onSubmit={event => {
              event.preventDefault();
              const invalid = event.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"], :invalid');
              if (invalid) { invalid.focus(); return; }
              onSearch();
            }}>
              <VStack width={mobile ? '100%' : 'calc(var(--spacing-12) * 6)'} style={{minWidth: 0}}>
                <TextInput type="search" label={t('search')} placeholder={t('search')} value={query} onChange={onQueryChange} width="100%" />
              </VStack>
              <VStack width={mobile ? 'calc(100% - var(--spacing-12) * 2)' : 'calc(var(--spacing-12) * 3)'}>
                <Selector label={t('status')} value={status} onChange={onStatusChange} width="100%"
                  options={['', 'active', 'deactivated', 'reported', 'deactivated_violation'].map(value => ({value, label: value ? t(value) : say('全部', 'All')}))} />
              </VStack>
              <Button label={t('search')} type="submit" variant="primary" isLoading={busy} />
            </HStack>
            {(rows.length > 0 || busy) && <Grid columns={mobile ? kind === 'rides' ? 1 : 2 : desktop ? 3 : 2} gap={mobile ? 3 : 5}>
              {busy && !rows.length && Array.from({length: desktop ? 3 : 2}, (_, index) => <Skeleton key={index} height="calc(var(--spacing-12) * 4)" index={index} />)}
              {rows.map(row => <ListingCard key={row.id} row={row} kind={kind} english={english} t={t} onOpen={() => onOpen(row)} />)}
            </Grid>}
            {!busy && !rows.length && <VStack padding={6} style={{background: 'var(--color-background-body)', borderRadius: 'var(--radius-element)'}}>
              <EmptyState isCompact title={query || status ? say('没有匹配的发布', 'No matching posts') : say('暂无发布', 'No posts yet')}
                icon={<Icon icon="viewColumns" color="accent" size="lg" />} actions={<Button label={say('去发布', 'Create a post')} variant="primary" onClick={onPublish} />} />
            </VStack>}
            {cursor && <Button label={say('加载更多', 'Load more')} isDisabled={busy} onClick={onMore} />}
          </VStack>
        </VStack>
      </Section>

      <Section className="account-favorites" variant="form-panel" padding={mobile ? 5 : 6} hidden={selected !== 'favorites'} role="region" aria-labelledby="account-favorites-heading" style={panelStyle('favorites')}>
        <VStack gap={5} aria-busy={favoriteBusy}>
          <Heading level={2} id="account-favorites-heading">{say('收藏', 'Saved items')}</Heading>
          {Boolean(favoriteError) && <Banner status="error" title={errorText(favoriteError, english)} role="alert" endContent={<Button label={t('retry')} onClick={onFavoritesRetry} />} />}
          {(favoriteRows.length > 0 || favoriteBusy) && <Grid columns={desktop ? 3 : 2} gap={mobile ? 3 : 5}>
            {favoriteBusy && !favoriteRows.length && Array.from({length: desktop ? 3 : 2}, (_, index) => <Skeleton key={index} height="calc(var(--spacing-12) * 4)" index={index} />)}
            {favoriteRows.map(row => <ListingCard key={row.id} row={row} kind="items" english={english} t={t} saved={favoriteIds.has(row.id)} onFavorite={() => onFavorite(row)} onOpen={() => onFavoriteOpen(row)} />)}
          </Grid>}
          {!favoriteBusy && !favoriteError && !favoriteRows.length && <EmptyState isCompact title={say('暂无收藏', 'No saved items')} icon={<Icon icon="checkDouble" color="accent" size="lg" />} />}
        </VStack>
      </Section>

      <Section className="account-password" variant="form-panel" padding={mobile ? 5 : 6} hidden={selected !== 'change-password'} role="region" aria-labelledby="account-password-heading" style={panelStyle('change-password')}>
        <VStack gap={5}>
          <Heading level={2} id="account-password-heading">{say('修改密码', 'Change password')}</Heading>
          <VStack width="100%" maxWidth="var(--lm-form-max)">{passwordForm}</VStack>
        </VStack>
      </Section>
    </VStack>
  </Grid>;
}
