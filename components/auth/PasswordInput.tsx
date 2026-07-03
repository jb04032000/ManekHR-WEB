'use client';

import { Input } from 'antd';
import type { InputRef } from 'antd';
import { ComponentProps, forwardRef } from 'react';
import { EyeInvisibleOutlined, EyeTwoTone, LockOutlined } from '@ant-design/icons';

type AntdPasswordProps = ComponentProps<typeof Input.Password>;

interface PasswordInputProps extends Omit<AntdPasswordProps, 'prefix' | 'iconRender'> {
  /** Defaults to "new-password". Set "current-password" for sign-in forms. */
  autoComplete?: AntdPasswordProps['autoComplete'];
}

/**
 * Project-standard password field - wraps Antd `Input.Password` with the lock
 * icon, eye reveal, and `autoComplete="new-password"` defaults used by every
 * password-collecting form. Use this everywhere a password is entered so the
 * visual + behavioural contract stays consistent.
 */
export const PasswordInput = forwardRef<InputRef, PasswordInputProps>(function PasswordInput(
  { autoComplete = 'new-password', size = 'large', ...rest },
  ref,
) {
  return (
    <Input.Password
      ref={ref}
      prefix={<LockOutlined className="text-subtle" />}
      iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
      size={size}
      autoComplete={autoComplete}
      {...rest}
    />
  );
});
