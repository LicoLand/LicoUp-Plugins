# LicoArc Plugins

Independent Codex plugin marketplace maintained by
[LicoLand](https://lico.land). The repository name and marketplace namespace
are intentionally retained for long-term plugin identity stability.

## Ecosystem boundary

This repository is an independent developer-tool marketplace:

- it is not [`Meshrix-Plugins`](https://github.com/LicoLand/Meshrix-Plugins)
  and does not publish Meshrix runtime plugins;
- it is not a LicoUp plugin repository or a component of the
  [LicoUp client](https://licoup.com);
- it is not the Fabrigent protocol or policy authority, and does not define
  federation governance published through [licoarc.com](https://licoarc.com).

Each plugin documents its own integration boundary. Installing a marketplace
plugin does not join a LicoUp network, install a Meshrix extension, or confer
Fabrigent certification.

## Marketplace

- Catalog: `.agents/plugins/marketplace.json`
- Display name: **LicoArc Independent Plugins**

Add this directory as a Codex marketplace:

```bash
codex plugin marketplace add .
```

## Plugins

| Plugin | Description |
| --- | --- |
| [`licoarc-for-codex`](./licoarc-for-codex) | Independent Codex sub-agent bridge using the retained LicoArc plugin namespace. |

## Current LicoLand projects

- [Meshrix](https://meshrix.io): agent behavior governance platform
- [LicoUp](https://licoup.com): human-agent collaboration client
- [Fabrigent / LicoArc](https://licoarc.com): federation protocol and governance authority
