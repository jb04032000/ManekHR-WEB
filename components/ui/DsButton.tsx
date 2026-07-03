'use client';
import { Button } from 'antd';
import type { ButtonProps } from 'antd';
import { useRouter } from 'next/navigation';
import type { CSSProperties, MouseEvent } from 'react';

type DsVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'neutral';
type DsSize = 'sm' | 'md' | 'lg';

interface DsButtonProps extends Omit<ButtonProps, 'size'> {
  dsVariant?: DsVariant;
  dsSize?: DsSize;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<DsVariant, CSSProperties> = {
  primary: {
    background: 'var(--cr-primary)',
    borderColor: 'var(--cr-primary)',
    color: 'var(--cr-surface)',
  },
  secondary: {
    background: 'var(--cr-secondary)',
    borderColor: 'var(--cr-secondary)',
    color: 'var(--cr-surface)',
  },
  ghost: { background: 'transparent', borderColor: 'var(--cr-border)', color: 'var(--cr-text-2)' },
  danger: {
    background: 'var(--cr-error)',
    borderColor: 'var(--cr-error)',
    color: 'var(--cr-surface)',
  },
  success: {
    background: 'var(--cr-success)',
    borderColor: 'var(--cr-success)',
    color: 'var(--cr-surface)',
  },
  neutral: {
    background: 'var(--cr-border-light)',
    borderColor: 'var(--cr-border)',
    color: 'var(--cr-text)',
  },
};
const SIZE_MAP: Record<DsSize, ButtonProps['size']> = { sm: 'small', md: 'middle', lg: 'large' };
const HEIGHT: Record<DsSize, number> = { sm: 30, md: 38, lg: 46 };

/**
 * Link variant: AntD renders the styled control AS an `<a>` (via `href`), and we
 * intercept the click for Next client-side routing. This keeps a CTA a single
 * interactive element instead of the nested `<a><button>` that wrapping a
 * DsButton in a Next `<Link>` produces. Modifier and middle clicks fall through
 * to the browser so "open in new tab" still works.
 */
function DsLinkButton({ href, onClick, children, ...rest }: ButtonProps & { href: string }) {
  const router = useRouter();
  const handleClick = (e: MouseEvent<HTMLElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    router.push(href);
  };
  return (
    <Button href={href} onClick={handleClick} {...rest}>
      {children}
    </Button>
  );
}

export default function DsButton({
  dsVariant = 'primary',
  dsSize = 'md',
  fullWidth,
  style,
  children,
  href,
  ...rest
}: DsButtonProps) {
  const vs = VARIANT_STYLES[dsVariant];
  const isNative = dsVariant === 'ghost' || dsVariant === 'neutral';
  const shared: ButtonProps = {
    type: isNative ? 'default' : 'primary',
    danger: dsVariant === 'danger',
    size: SIZE_MAP[dsSize],
    block: fullWidth,
    style: { height: HEIGHT[dsSize], ...vs, ...style },
    ...rest,
  };

  if (href) {
    return (
      <DsLinkButton href={href} {...shared}>
        {children}
      </DsLinkButton>
    );
  }

  return <Button {...shared}>{children}</Button>;
}
