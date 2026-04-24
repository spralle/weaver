---
"@weaver/config-types": minor
"@weaver/config-providers": minor
---

Add pluggable scope resolution cache for efficient batch getForScope() calls.
New ScopeResolutionCache interface, built-in LRU implementation via createScopeResolutionCache(),
and opt-in scopeCache option on ConfigurationServiceOptions.
