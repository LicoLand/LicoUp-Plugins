# LicoUp Plugins Ubiquitous Language

This glossary defines repository-local vocabulary. It contains no
implementation, verification, release, support, or operation claims.

| Term | Meaning |
| --- | --- |
| **External integration** | An optional capability maintained outside the LicoUp client and connected through a public LicoUp contract. |
| **Integration package** | The independently reviewable and removable source, metadata, and documentation for one external integration. |
| **Marketplace** | The discovery boundary that lists eligible external integration packages. |
| **Catalog entry** | A marketplace declaration that identifies one integration package without proving its packaging, verification, publication, or support state. |
| **Public LicoUp contract** | A versioned interface owned and published by LicoUp through which an external integration may interact with the client. |
| **Client approval** | A LicoUp-owned decision that authorizes an integration to request a client-controlled effect. |
| **Host boundary** | The LicoUp-owned execution boundary through which an approved integration reaches permitted client capability. |
| **Built-in client capability** | A capability owned, shipped, and maintained by the LicoUp client rather than by this repository. |
| **Empty marketplace** | A marketplace with no catalog entries and therefore no external integration available for discovery. |
| **Compatibility shell** | A package that preserves a retired name or contract without owning a current public LicoUp integration; it is not an external integration. |
| **Companion runtime** | A LicoUp-owned executable shipped by the installed client and consumed by an external integration through its documented local contract. |
| **Private handoff** | A local conversation-file location returned for same-machine continuation; it is runtime data and must never enter public output or evidence. |
