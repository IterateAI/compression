# Third-Party Notices — AgentOne Token Compression

This product includes software and techniques derived from third-party
open-source projects. Their original license terms are reproduced/summarized
below and govern the corresponding portions of this product to the extent of
any conflict with the AgentOne EULA (see LICENSE).

## Headroom (Apache License 2.0)

- Project: Headroom
- Source: https://github.com/chopratejas/headroom
- License: Apache License, Version 2.0

Portions of the mask-union / reversible-compression (CCR) architecture in the
bundled `@iterate/token-optimizer` engine — including the logic in
`strategies/maskUnion.js` and `strategies/ccr.js` and related content-routing
and entropy-protection modules — were originally derived from and inspired by
the Headroom project.

Apache-2.0 compliance checklist (verify before distribution):
- [ ] Include a full copy of the Apache License 2.0 with the distribution.
- [ ] Retain all copyright, patent, trademark, and attribution notices from the
      Headroom source (copy its NOTICE file, if any, verbatim).
- [ ] State that changes were made: the derived files were modified and adapted
      by Iterate.ai for the AgentOne engine.
- [ ] Confirm the upstream copyright holder(s) from the Headroom repository and
      record them here.

> NOTE (not legal advice): Apache-2.0 permits proprietary and commercial
> derivative works, but its attribution, license-inclusion, change-statement,
> and patent terms (including §3 patent grant and §3 patent-retaliation) apply
> to the derived portions and cannot be overridden by a downstream proprietary
> license. Have counsel confirm the full compliance steps and reconcile them
> with the AgentOne EULA before publishing.
