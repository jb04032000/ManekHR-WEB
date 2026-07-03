'use client';
import { useState } from 'react';
import { ConfigProvider, App, Modal } from 'antd';
import { useServerInsertedHTML } from 'next/navigation';
import { createCache, extractStyle, StyleProvider } from '@ant-design/cssinjs';
import { theme } from '@/lib/theme';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { env } from '@/lib/env';
import AntdA11yPatches from './AntdA11yPatches';

// Fix for Ant Design v6: Use type assertion to set defaultProps
(Modal as any).defaultProps = {
  ...(Modal as any).defaultProps,
  styles: {
    body: { maxHeight: '70vh', overflowY: 'auto' },
    wrapper: { paddingTop: 20, paddingBottom: 20 },
  },
  centered: true,
};

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  const googleClientId = env.googleClientId;

  // Ant Design v6 css-in-js SSR: extract the styles generated during the server
  // render and inject them into <head> so the server- and client-rendered class
  // hashes match. Without this the generated `ant-app` className differs between
  // server and client and React logs a hydration mismatch on every hard load.
  // Mirrors @ant-design/nextjs-registry using antd's bundled @ant-design/cssinjs
  // (no extra dependency).
  const [cache] = useState(() => createCache());
  useServerInsertedHTML(() => (
    <style id="antd-cssinjs" dangerouslySetInnerHTML={{ __html: extractStyle(cache, true) }} />
  ));

  return (
    <StyleProvider cache={cache}>
      <ConfigProvider theme={theme}>
        <App>
          <AntdA11yPatches />
          {googleClientId ? (
            <GoogleOAuthProvider clientId={googleClientId}>{children}</GoogleOAuthProvider>
          ) : (
            children
          )}
        </App>
      </ConfigProvider>
    </StyleProvider>
  );
}
