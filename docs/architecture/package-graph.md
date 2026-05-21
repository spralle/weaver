# Package Dependency Graph

## Overview

Weaver follows a strict upward dependency flow. Leaf packages have zero internal dependencies, composite packages depend only on packages below them.

## Graph

```mermaid
graph TD
    CT[config-types] --> CE[config-engine]
    CT --> CA[config-auth]
    CT --> CSE[config-sessions]
    CT --> CSC[config-secrets]
    CE --> CP[config-policy]
    CT --> CP
    CE --> CR[config-runtime]
    CE --> CS[config-sync]
    CT --> CS
    CE --> SP[storage-providers]
    CT --> SP
    CE --> SPLS[storage-provider-local-storage]
    CT --> SPLS
    CE --> SPSJ[storage-provider-static-json]
    CT --> SPSJ
    CE --> WC[weaver-client]
    CR --> WC
    CS --> WC
    CT --> WC
    CE --> WS[weaver-server]
    CT --> WS
    CA --> WS
    SP --> WS
```

## Layer Summary

| Layer | Packages |
|-------|----------|
| **Leaf** (zero internal deps) | `config-types` |
| **Core utilities** | `config-engine` |
| **Domain** | `config-auth`, `config-sessions`, `config-secrets`, `config-policy`, `config-runtime`, `config-sync` |
| **Storage** | `storage-providers`, `storage-provider-local-storage`, `storage-provider-static-json` |
| **Consumer** (top-level) | `weaver-client`, `weaver-server` |

## Rules

1. Dependencies flow **upward** (leaf → composite)
2. No circular dependencies
3. `config-types` is the universal leaf — everything can depend on it
4. `config-engine` provides utilities used by both client and server
5. `weaver-client` and `weaver-server` are the top-level consumer packages
