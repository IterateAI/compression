# Third-Party Notices — AgentOne Token Compression

This product includes software and techniques derived from third-party
open-source projects. Their original license terms are reproduced below and
govern the corresponding portions of this product; where those terms grant
rights, they prevail over any conflicting term of the AgentOne license (see
LICENSE).

--------------------------------------------------------------------------

## Headroom — Apache License 2.0

- Project:   Headroom
- Source:    https://github.com/chopratejas/headroom
- Copyright: Copyright 2025 Headroom Contributors
- License:   Apache License, Version 2.0 (full text: see `Apache-2.0.txt`)

Portions of the mask-union / reversible-compression (CCR) architecture in the
bundled `@iterate/token-optimizer` engine — including the logic in
`strategies/maskUnion.js`, `strategies/ccr.js`, and related content-routing and
entropy-protection modules — were **originally derived from and inspired by**
the Headroom project.

**Statement of changes (Apache-2.0 §4(b)):** These files were modified and
adapted by Iterate.ai for the AgentOne Token Compression engine — including a
JavaScript/TypeScript reimplementation, integration with AgentOne's caching,
content-type routing, dictionary codec, and compression governor, and packaging
as a Claude Code plugin. They are not the original Headroom files.

Apache-2.0 compliance for this distribution:
- [x] Full copy of the Apache License 2.0 included — see `Apache-2.0.txt`.
- [x] Upstream copyright/attribution notices retained (this file).
- [x] Statement that changes were made (above).
- [x] Upstream NOTICE reproduced (below).

### Reproduced from Headroom's NOTICE (upstream)

The following is reproduced from Headroom's `NOTICE` file, as required by
Apache-2.0 §4(d). Some entries describe optional upstream dependencies of
Headroom (a Python project) that are **not necessarily included** in this
JavaScript distribution; they are retained here for attribution completeness.

```
Headroom
Copyright 2025 Headroom Contributors

This product includes software developed by the Headroom Contributors.

Third-Party Licenses
====================
tiktoken               — Copyright (c) 2022 OpenAI, Shantanu Jain — MIT
Pydantic               — Copyright (c) 2017-present Pydantic Services Inc. and contributors — MIT
sentence-transformers  — Copyright 2019 Nils Reimers — Apache-2.0
FastAPI                — Copyright (c) 2018 Sebastián Ramírez — MIT
NumPy                  — Copyright (c) 2005-2024 NumPy Developers — BSD-3-Clause
```

--------------------------------------------------------------------------

> NOTE (not legal advice): Apache-2.0 permits proprietary and commercial
> distribution of derivative works (including in compiled/bundled form), but its
> attribution, license-inclusion, change-statement, and patent terms apply to
> the derived portions and are not overridden by the AgentOne license. Have
> counsel confirm this satisfies your obligations before publishing.
