# Task 13.2C — MakeHuman hm08 basemesh provenance

## Selected asset

- Repository: makehumancommunity/makehuman
- Upstream commit: 1f508f6083b2f823dab15de924b3bde72e08d77c (MakeHuman v1.3.0)
- Path: makehuman/data/3dobjs/base.obj
- SHA-256: 8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c
- Intended use: body-only anatomical base topology for Task 13.2C.
- Preparation: retain the upstream g body geometry, remove helper/joint geometry, preserve topology, then export as GLB for the app pipeline.

## License basis

The MakeHuman project states that bundled graphical assets, including the base mesh, are released under CC0 1.0 Universal. The application source code is separately licensed; this task uses the graphical asset only.

This file pins the exact upstream commit and SHA-256 so the source asset can be independently verified.

## Scope

This is not the final male body. It is the anatomical topology starting point that will later be fitted to the approved male reference using the silhouette/deformation pipeline.
