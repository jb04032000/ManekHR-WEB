import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { Follow } from '../network.types';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const unfollowUser = vi.fn();
vi.mock('../network.actions', () => ({
  unfollowUser: (...a: unknown[]) => unfollowUser(...a),
}));

const unfollowCompanyPage = vi.fn();
vi.mock('../entities/company-page.actions', () => ({
  unfollowCompanyPage: (...a: unknown[]) => unfollowCompanyPage(...a),
}));

import FollowingTab from './FollowingTab';
import type { PeopleIndex } from './hydrate';
import type { CompanyPageRef } from '../feed.types';

const COMPANY: CompanyPageRef = {
  id: 'c1',
  name: 'Surat Zari Works',
  slug: 'surat-zari-works',
  logo: '',
};

function follow(over: Partial<Follow> = {}): Follow {
  return {
    _id: 'f1',
    followerId: 'u-me',
    followeeType: 'user',
    followeeId: 'u1',
    createdAt: '2025-03-01T00:00:00.000Z',
    ...over,
  };
}

const PEOPLE: PeopleIndex = {
  u1: { userId: 'u1', name: 'Priya Joshi', avatar: null, headline: 'Hand embroidery' },
};

function renderTab(follows: Follow[], people = PEOPLE, companyPages: CompanyPageRef[] = []) {
  return renderWithIntl(
    <AntApp>
      <FollowingTab follows={follows} people={people} companyPages={companyPages} />
    </AntApp>,
  );
}

describe('FollowingTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists followed people resolved from the people index', () => {
    renderTab([follow()]);
    expect(screen.getByText('Priya Joshi')).toBeInTheDocument();
  });

  it('renders the empty state when nobody is followed', () => {
    renderTab([]);
    expect(screen.getByText('You are not following anyone yet')).toBeInTheDocument();
  });

  it('skips a companyPage follow whose identity did not hydrate (no broken row)', () => {
    // No matching ref in `companyPages` -> the row is dropped, not shown broken.
    renderTab([follow({ _id: 'f9', followeeType: 'companyPage', followeeId: 'c1' })]);
    expect(screen.getByText('You are not following anyone yet')).toBeInTheDocument();
  });

  it('renders a followed workshop (company page) with a link to its page', () => {
    renderTab([follow({ _id: 'f9', followeeType: 'companyPage', followeeId: 'c1' })], PEOPLE, [
      COMPANY,
    ]);
    // Avatar + name both link to the page (mirrors PersonCard's two links).
    const links = screen.getAllByRole('link', { name: 'Surat Zari Works' });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((l) => expect(l.getAttribute('href')).toBe('/connect/company/surat-zari-works'));
    expect(screen.getByText('Workshop')).toBeInTheDocument();
  });

  it('unfollows a workshop via the company-page action', async () => {
    unfollowCompanyPage.mockResolvedValue({ ok: true, data: { ok: true } });
    renderTab([follow({ _id: 'f9', followeeType: 'companyPage', followeeId: 'c1' })], PEOPLE, [
      COMPANY,
    ]);

    screen.getByRole('button', { name: 'Unfollow' }).click();

    await waitFor(() => {
      expect(unfollowCompanyPage).toHaveBeenCalledWith('c1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Surat Zari Works')).not.toBeInTheDocument();
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('unfollows a person, drops the row, and refreshes the route', async () => {
    unfollowUser.mockResolvedValue({ ok: true, data: { unfollowed: true } });
    renderTab([follow()]);

    screen.getByRole('button', { name: 'Unfollow' }).click();

    await waitFor(() => {
      expect(unfollowUser).toHaveBeenCalledWith('u1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Priya Joshi')).not.toBeInTheDocument();
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('keeps the row when an unfollow fails', async () => {
    unfollowUser.mockResolvedValue({ ok: false, error: 'Network down' });
    renderTab([follow()]);

    screen.getByRole('button', { name: 'Unfollow' }).click();

    await waitFor(() => {
      expect(unfollowUser).toHaveBeenCalled();
    });
    expect(screen.getByText('Priya Joshi')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
