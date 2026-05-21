# @weaver/storage-provider-local-storage

> Browser localStorage storage provider for Weaver — enables client-side configuration persistence.

## Installation

```bash
bun add @weaver/storage-provider-local-storage
```

## Usage

```typescript
import { createLocalStorageProvider } from "@weaver/storage-provider-local-storage";

const provider = createLocalStorageProvider({
  prefix: "weaver:",
});
```

## API

- `createLocalStorageProvider(options)` — Creates a storage provider backed by browser localStorage
- `LocalStorageProviderOptions` — Configuration including key prefix and serialization options

## License

MIT
