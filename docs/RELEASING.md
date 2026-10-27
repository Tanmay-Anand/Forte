# Forte — Releasing and Updating

How a change gets from this repo onto the phone. There are two kinds of change, and they travel
differently.

| Change | Example | How it ships | What you do on the phone |
|---|---|---|---|
| **JavaScript only** | A screen, a query, the pre-fill rules | `npm run update` (EAS Update) | Tap **Restart** on the *Update ready* bar |
| **Native** | A new native library, a permission, an `app.json` plugin | A new APK on GitHub Releases | Tap **Update** in Obtainium |

If you're unsure which one a change is: if `package.json` gained a dependency with native code, or
`app.json` changed anything under `android` or `plugins`, it is native.

---

## 1. JavaScript-only updates

```bash
npm run update
```

The app checks for an update when it starts, and again when you return to it after 30 minutes or
more away. It downloads updates in the background. When one is ready, an **Update ready · Restart**
bar appears above the tab bar (`src/features/updates/UpdateBar.tsx`). It is hidden during a
workout. If you dismiss it, the update applies the next time Forte starts.

An update only reaches installs with the same `version` in `app.json` (`runtimeVersion` policy
`appVersion`). That is deliberate: JavaScript that expects a native module must never reach an APK
that lacks it.

---

## 2. Native releases (new APK)

### One-time setup

1. Create an access token at **expo.dev → Account settings → Access tokens**.
2. On GitHub, open **Forte → Settings → Secrets and variables → Actions → New repository secret**.
   Name it `EXPO_TOKEN` and paste the token.

The release workflow builds on EAS with the credentials EAS already stores for this project. This
is the same signing key as every earlier `npm run build:apk`, so each APK installs over the last.

### Each release

1. Bump the version in **both** places:
   - `app.json` → `expo.version` (e.g. `1.2.0`) **and** `expo.android.versionCode` (+1)
   - `package.json` → `version`
2. Add a `## v1.2.0` section to `RELEASE_NOTES.md`. It becomes the GitHub release text.
3. Commit, then tag and push:

   ```bash
   git tag v1.2.0
   ```

   ```bash
   git push origin main v1.2.0
   ```

`.github/workflows/release.yml` then:
- checks that the tag matches `app.json`
- runs the typecheck and tests
- builds the APK on EAS
- publishes `forte-v1.2.0.apk` as a GitHub Release

Expect 15–30 minutes, most of it in the EAS free-tier queue. Obtainium picks the release up on its
next check.

**Never reuse or move a tag.** Obtainium compares the release tag with the installed version.
A release whose tag doesn't match the APK's version makes it offer the same update forever.

No CI? You can do the same by hand. Run `npm run build:apk`, download the APK from the EAS build
page, and create a GitHub release with tag `v1.2.0` and the file attached as `forte-v1.2.0.apk`.

---

## 3. Obtainium on the phone (once)

[Obtainium](https://github.com/ImranR98/Obtainium) is a free, open-source Android app that installs
and updates apps straight from their GitHub releases.

1. Install Obtainium from its GitHub releases page or F-Droid.
2. On the phone, open this link. It opens Obtainium with Forte filled in:

   https://apps.obtainium.imranr.dev/redirect?r=obtainium://app/%7B%22id%22%3A%22com.forte.tracker%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2FTanmay-Anand%2FForte%22%2C%22author%22%3A%22Tanmay-Anand%22%2C%22name%22%3A%22Forte%22%7D

   Or add it manually: **Add App** → paste `https://github.com/Tanmay-Anand/Forte` → **Add**.
3. Obtainium recognises the Forte already on your phone (package `com.forte.tracker`) and shows
   whether a newer release exists.
4. Allow Obtainium to install apps when Android asks. That's the one-time "Install unknown apps"
   permission.

From then on: Obtainium notifies you → tap **Update** → confirm Android's install prompt. Data is
untouched, because an update installs over the existing app.

**If the update fails with "App not installed" or a signature conflict,** the installed APK was
signed with a different key. This happens if it was built locally instead of on EAS. The only fix
is to uninstall and reinstall, which **deletes the database**. Export a JSON backup first
(Settings → Your data), then import it after reinstalling.
