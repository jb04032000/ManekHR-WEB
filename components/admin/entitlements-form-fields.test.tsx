/**
 * EntitlementsFormFields -- regression test for the "Set to Unlimited" clobber.
 *
 * Bug: handleSetUnlimited wrote `{ [fieldName[0]]: -1 }` via setFieldsValue. With
 * namePrefix="entitlements" the field name is the NESTED path
 * ['entitlements','maxWorkspaces'], so fieldName[0] === 'entitlements' and the
 * patch became `{ entitlements: -1 }` -- which REPLACES the whole nested
 * entitlements object with the number -1, wiping every other cap in the form.
 *
 * This test mounts the component under a tiny harness that captures the AntD
 * form instance, seeds a sibling nested cap, clicks the per-field "Set to
 * Unlimited" button for Max Workspaces, and asserts the targeted field is -1
 * WHILE the sibling cap survives (entitlements still an object).
 *
 * Cross-module link: components/admin/entitlements-form-fields.tsx is consumed
 * by app/admin/plans/page.tsx with namePrefix="entitlements" -- the only caller
 * that passes showUnlimitedButton, hence the nested-path clobber surfaced there.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { Form } from 'antd';
import { renderWithIntl, screen } from '@/test-utils/render';
import { EntitlementsFormFields } from './entitlements-form-fields';

// Harness: exposes getFieldsValue() through a button so the test can read the
// live form state after interacting with the component under test.
function Harness({ onRead }: { onRead: (values: Record<string, unknown>) => void }) {
  const [form] = Form.useForm();
  return (
    <Form
      form={form}
      initialValues={{
        entitlements: { maxWorkspaces: 3, maxMembersPerWorkspace: 5, maxTotalMembers: 5 },
      }}
    >
      <EntitlementsFormFields namePrefix="entitlements" min={-1} showUnlimitedButton />
      <button type="button" onClick={() => onRead(form.getFieldsValue(true))}>
        read-values
      </button>
    </Form>
  );
}

describe('EntitlementsFormFields "Set to Unlimited"', () => {
  it('sets only the targeted nested field to -1 without clobbering sibling caps', () => {
    let captured: Record<string, unknown> = {};
    renderWithIntl(<Harness onRead={(v) => (captured = v)} />);

    // The per-field "Set to Unlimited" buttons carry the InfoCircleOutlined
    // icon (accessible name "info-circle"); the Tooltip title is portalled, not
    // an aria-label. The first grid field is Max Workspaces, so its button is
    // the first such control.
    const unlimitedButtons = screen.getAllByRole('button', { name: /info-circle/i });
    fireEvent.click(unlimitedButtons[0]);

    // Read the live form values.
    fireEvent.click(screen.getByRole('button', { name: 'read-values' }));

    const entitlements = captured.entitlements as
      | { maxWorkspaces?: number; maxMembersPerWorkspace?: number }
      | number;

    // Must still be a nested object, not clobbered to the number -1.
    expect(typeof entitlements).toBe('object');
    expect((entitlements as { maxWorkspaces?: number }).maxWorkspaces).toBe(-1);
    expect((entitlements as { maxMembersPerWorkspace?: number }).maxMembersPerWorkspace).toBe(5);
  });
});
