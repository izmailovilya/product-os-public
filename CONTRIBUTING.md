# Contribute a skill

If you want to share a skill, ask your agent to prepare a contribution. It checks
an example, generalizes the skill and shows the complete public package first.
See [Custom skills](CUSTOM-SKILLS.md) for commands.

Submit a separate pull request under `community-skills/<name>/`. Include AUTHOR.md,
an anonymized example and the observed verification result. Materials must permit
MIT distribution; preserve compatible licenses and original attribution for borrowed
work. Exclude real product research, interviews, credentials and personal data.

The maintainer reviews whether the skill solves its stated problem, uses shared
memory without losing provenance, and clearly states limitations and usage rights.
Acceptance is not guaranteed. Accepted contributions retain credit in the community
catalog and release notes.

The public edition is generated from the source toolkit. Before exporting a release,
the maintainer imports accepted contributions into its `community-skills/` directory.
Do not add them to the eight bundled skills or edit PUBLIC-RELEASE.json by hand;
the exporter generates that manifest.
