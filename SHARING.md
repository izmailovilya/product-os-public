# Share the console with your team

Ask your agent to share the console. Colleagues receive a read-only snapshot link;
editing and agent launches are unavailable. Hosting works independently of your
computer. Publish a new snapshot under the same name to update the shared view.

## Choose access

For the first publication, choose public access or a shared password. A password
is recommended for private material. Respect a choice already given and do not
publish before it is known. Public access allows anyone with the address to view
materials. A shared password has no individual roles or per-person revocation;
changing it invalidates previous sessions.

The choice is saved for updates. Change it only when instructed, with
`--change-access`. Show the access mode and snapshot contents before publication.
The snapshot includes all saved product memory, PRODUCT.md, MOVES.md, IDEAS.md and
reports. Selecting individual segments is not supported.

Original `sources/` files are excluded by default. Include them only when instructed
with `--include-sources`; use `--exclude-sources` to remove previously included
originals from a new snapshot. Images, fonts and structured identity/reference
packages needed for display are included and listed separately. Quotations and
source-derived information can remain in memory and reports regardless of this
flag. Nothing is automatically anonymized.

## Prepare and review

Run commands through the installed `node <tools>/bin/product-os.js`:

```sh
product-os share prepare . --access password --name my-product-console
product-os share review <package>
product-os share preview <package>
```

`prepare` creates a local package in `.product-os/shares/` using a temporary copy
of the data. It does not publish. REVIEW.json lists files, unavailable attachments,
the date and access mode. Review actual content in the preview, including memory,
reports, images and downloads; filenames alone are insufficient. Repeating
`prepare` preserves the Worker name, access mode, source-file choice and configured
password unless the owner changes them.

## Set a password

Use secure input, never chat or command arguments. In BB, request a secret into
an explicit protected file:

```sh
bb secret request PRODUCT_OS_SHARE_PASSWORD \
  --purpose "Set a password for the shared console" \
  --describe PRODUCT_OS_SHARE_PASSWORD "Shared team password, at least 12 characters" \
  --write-env <protected-dotenv-file>
product-os share password <package> --env-file <protected-dotenv-file>
```

In other environments, use their secure credential input or have the owner create
a dotenv file outside published assets. Use at least 12 characters, preferably a
long random password. The command reads it without printing it.

`.dev.vars` stores a salt, a PBKDF2-derived hash and a random session-signing key;
the original password is not copied into the package. The browser performs 600,000
PBKDF2 iterations and the server verifies an additional hash. This keeps password
guessing expensive while allowing fast verification within free Worker CPU limits.
The site and login require HTTPS and JavaScript. The secrets file has mode 0600
and stays outside `assets/`. Do not read its values into chat or reports. Repeating
`share password` rotates the salt and key; publishing invalidates old sessions.

## Publish to Cloudflare

You need a Cloudflare account and Wrangler authentication through `npx wrangler login`
or an existing token. Do not enable paid services or change the plan. Hosting is
subject to Cloudflare Workers quotas; unlimited free hosting is not promised.

After reviewing the package and obtaining authorization to publish its specific data:

```sh
product-os share deploy <package> --approved-digest <digest-from-share-review>
```

The command checks the current digest, runs the pinned Wrangler version and passes
secrets directly from the file. It publishes only the prepared snapshot, not the
product folder. Return the actual deployment URL, snapshot date and access mode.
Check the link without a session and after login, including direct data/download
URLs. An access or hosting error is a failure, not a successful publication.

For a remote BB preview, use an existing Connect route only when asked to show it;
localhost is not accessible on another person's device. With a trusted HTTPS reverse
proxy, use `--origin <https-origin>` so origin and cookie checks use the external
address. A preview is not a permanent deployment.

## Protection

The Worker checks requests before serving static assets. Product HTML, API data,
attachments and images use an explicit route inventory; internal file paths do not
bypass authentication. Only the Product OS login shell and fonts are public without
product data. Sessions last eight hours, are signed and bound to the site and
password version, and use Secure/HttpOnly/SameSite cookies. Login checks the form
origin, request size and attempt limits. Data writes and agent launches remain
unavailable after login.
