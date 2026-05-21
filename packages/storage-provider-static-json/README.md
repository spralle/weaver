# @weaver/storage-provider-static-json

> Read-only static JSON storage provider for Weaver — serves configuration from bundled JSON files.

## Installation

```bash
bun add @weaver/storage-provider-static-json
```

## Usage

```typescript
import { createStaticJsonStorageProvider } from "@weaver/storage-provider-static-json";

const provider = createStaticJsonStorageProvider({
  data: { "theme.mode": "dark", "feature.beta": true },
});
```

## API

- `createStaticJsonStorageProvider(options)` — Creates a read-only provider from a static JSON object
- `StaticJsonProviderOptions` — Configuration including the static data source

## License

MIT
