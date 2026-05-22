# @weaver-conf/config-runtime

> Pure state machine for Weaver configuration resolution — manages layer entries, snapshots, and delta subscriptions.

## Installation

```bash
bun add @weaver-conf/config-runtime
```

## Usage

```typescript
import { createStateContainer } from "@weaver-conf/config-runtime";

const container = createStateContainer({ entries: {}, revision: "0" });

container.applyDelta({ key: "theme.mode", value: "dark", revision: "1" });
console.log(container.snapshot().entries["theme.mode"]); // "dark"
```

## API

- `createStateContainer(initial)` — Creates a reactive state container from an initial snapshot
- `StateContainer` — Interface for reading snapshots and applying deltas
- `StateSnapshot` — Point-in-time configuration state
- `ConfigDelta` — A single key-value change with revision metadata
- `LayerEntry` — A configuration entry with layer provenance

## License

MIT
