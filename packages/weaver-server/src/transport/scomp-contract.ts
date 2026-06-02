// Re-export the shared contract from @weaver-conf/transport-scomp
export { WeaverConfig } from "@weaver-conf/transport-scomp";
export type { WeaverConfigContract } from "@weaver-conf/transport-scomp";

/** @deprecated Use WeaverConfig token from @weaver-conf/transport-scomp instead */
export const WEAVER_CONFIG_V1 = "weaver-config-v1" as const;
