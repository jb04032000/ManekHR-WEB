import { describe, it, expect } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { PostMedia } from '@/features/connect/feed.types';
import PhotoCarousel from './PhotoCarousel';

const media: PostMedia[] = [
  { url: 'a.jpg', type: 'image' },
  { url: 'b.jpg', type: 'image' },
  { url: 'c.jpg', type: 'image' },
];

function render(items: PostMedia[]) {
  return renderWithIntl(
    <AntApp>
      <PhotoCarousel media={items} />
    </AntApp>,
  );
}

describe('PhotoCarousel', () => {
  it('renders one labelled slide per photo inside a carousel region', () => {
    render(media);
    expect(screen.getByRole('region', { name: 'Photo slideshow' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Photo 1 of 3' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Photo 3 of 3' })).toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(3);
  });

  it('renders a dot control per photo plus prev / next arrows', () => {
    render(media);
    expect(screen.getByRole('button', { name: 'Go to photo 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to photo 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeInTheDocument();
  });

  it('is bounded - Previous is disabled on the first slide', () => {
    render(media);
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeEnabled();
  });
});
