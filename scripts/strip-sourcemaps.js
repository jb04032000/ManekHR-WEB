// Post-build: shrink the .next deploy artifact so the SSR compute bundle stays
// under AWS Amplify's ~230MB cap. Two independent trims:
//
//   1. Source maps (~150MB from Next/Turbopack). They only de-minify server
//      stack traces via Sentry, which isn't wired up yet (no SENTRY_AUTH_TOKEN).
//      When Sentry is set up, upload + auto-delete via the Sentry plugin instead
//      of stripping here.
//
//   2. The Turbopack persistent build cache at .next/cache (tens of MB). It is a
//      BUILD-time accelerator only and is never read at runtime, but Amplify
//      packages the whole .next directory as the deploy artifact, so the cache
//      counts against the size cap. This was the actual cause of the
//      "build output exceeds max allowed size" failure: the runtime output is
//      ~175MB but .next/cache pushed the packaged artifact to ~221MB. Deleting
//      it here removes ~45MB with headroom. Tradeoff: Amplify's cross-build
//      cache (cache.paths in the build settings) captures an empty dir, so the
//      next build can't reuse Turbopack's cache. Correctness over build speed.
//
// IMPORTANT: only touches .next (the deploy artifact), never source or
// node_modules. Cross-platform (plain node fs) so it runs on Windows + CI.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '.next');
let removed = 0;
let bytes = 0;

// Trim 1: delete every .next source map.
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.map')) {
      try {
        bytes += fs.statSync(full).size;
        fs.rmSync(full);
        removed += 1;
      } catch {
        // best-effort; a missing file is fine
      }
    }
  }
}

walk(root);
console.log(
  `[strip-sourcemaps] removed ${removed} source maps (${(bytes / 1024 / 1024).toFixed(1)} MB) from .next`,
);

// Trim 2: drop the Turbopack build cache from the deploy artifact.
const cacheDir = path.join(root, 'cache');
let cacheBytes = 0;
try {
  const measure = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) measure(f);
      else {
        try {
          cacheBytes += fs.statSync(f).size;
        } catch {
          // best-effort
        }
      }
    }
  };
  if (fs.existsSync(cacheDir)) {
    measure(cacheDir);
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
} catch {
  // best-effort; missing cache is fine
}
console.log(
  `[strip-sourcemaps] removed .next/cache build cache (${(cacheBytes / 1024 / 1024).toFixed(1)} MB)`,
);

// AWS Amplify compute-bundle trim: npm installs BOTH the glibc and musl builds
// of sharp's native libvips (sharp lists both as optionalDependencies). Amplify's
// SSR compute runs on Amazon Linux (glibc), so the musl build is dead weight that
// is never loaded at runtime - but it still gets packaged, adding ~16.5MB and
// pushing the bundle over Amplify's hard ~220MB limit.
//
// Verified in an exact Amplify repro (node:22 glibc, output:standalone): deleting
// the musl variant drops the deployed bundle 227.7MB -> 211.2MB, the production
// server still boots, pages serve, and /_next/image (sharp glibc) returns 200.
//
// Guarded to Amplify CI only (AWS_APP_ID is set there) so local builds - which may
// be on macOS/Windows, or even a musl distro where this binary IS needed - are
// never touched. Cross-platform safe: a missing path is a no-op.
// Ref: AWS docs "delete unused runtime binaries after the build".
if (process.env.AWS_APP_ID || process.env.AWS_AMPLIFY_DEPLOYMENT_ID) {
  const variants = [
    '@img/sharp-libvips-linuxmusl-x64',
    '@img/sharp-linuxmusl-x64',
    '@img/sharp-libvips-linuxmusl-arm64',
    '@img/sharp-linuxmusl-arm64',
  ];
  // Clean both the root node_modules (what Amplify traces + packages) and the
  // standalone copy (Next pre-copies node_modules into .next/standalone before
  // this postbuild runs, so it must be cleaned separately for Docker/standalone).
  const muslSharp = variants.flatMap((v) => [
    `node_modules/${v}`,
    `.next/standalone/node_modules/${v}`,
  ]);
  let muslBytes = 0;
  for (const rel of muslSharp) {
    const dir = path.join(__dirname, '..', rel);
    if (!fs.existsSync(dir)) continue;
    try {
      // size the dir before removing
      const sizeOf = (d) => {
        let s = 0;
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const f = path.join(d, e.name);
          s += e.isDirectory() ? sizeOf(f) : fs.statSync(f).size;
        }
        return s;
      };
      muslBytes += sizeOf(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort; never fail the build over a cleanup
    }
  }
  console.log(
    `[strip-sourcemaps] removed unused musl sharp binaries (${(muslBytes / 1024 / 1024).toFixed(1)} MB) - Amplify runs glibc`,
  );
}
