import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import ERPCallout from './ERPCallout';

describe('ERPCallout', () => {
  it('renders the karigar count and Indian-formatted payroll', () => {
    renderWithIntl(<ERPCallout karigarCount={17} payrollPaise={44950000} />);
    expect(screen.getByText(/17 active workers/)).toBeInTheDocument();
    expect(screen.getByText(/₹4,49,500/)).toBeInTheDocument();
  });

  it('links to the ERP dashboard', () => {
    renderWithIntl(<ERPCallout karigarCount={1} payrollPaise={0} erpHref="/dashboard" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/dashboard');
  });
});
