'use client';

import ServiceWorkerRegistrar from './ServiceWorkerRegistrar';
import InstallPrompt from './InstallPrompt';
import EnablePushBanner from '../push/EnablePushBanner';
import PushAutoRepair from '../push/PushAutoRepair';

// Single mount point for installable-app (PWA) + browser-push client behaviour:
// registers the service worker, renders the install prompt, and renders the
// enable-notifications soft-prompt banner. Mounted once in app/layout.tsx,
// inside the antd + next-intl providers (InstallPrompt + EnablePushBanner need
// both). ServiceWorkerRegistrar renders nothing; InstallPrompt renders only when
// the install is available and not recently dismissed; EnablePushBanner renders
// only when push is supported + permission is 'default' + not dismissed.
export default function PwaManager() {
  return (
    <>
      <ServiceWorkerRegistrar />
      <InstallPrompt />
      <EnablePushBanner />
      {/* Silent re-registration for browsers that opted in before the SW scope
          fix; renders nothing (see component doc). */}
      <PushAutoRepair />
    </>
  );
}
