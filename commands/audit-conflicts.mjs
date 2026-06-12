export const AUDIT_FLAG_CONFLICTS = [
  { pair: ["cloud", "swarm"], msg: "--cloud and --swarm are mutually exclusive (use --cloud for dataset lookup, --swarm for local + contribute)" },
  { pair: ["cloud", "check"], msg: "--cloud is a dataset lookup; --check requires a local crawl" },
  { pair: ["local", "cloud"], msg: "--local is now the default; --local and --cloud cannot be combined" },
  { pair: ["local", "swarm"], msg: "--local is now the default; --local and --swarm cannot be combined" },
]

export const AUDIT_SOURCES = ["static", "local", "cloud", "swarm"]

export function selectAuditSource(opts) {
  if (opts.cloud) return "cloud"
  if (opts.swarm) return "swarm"
  return "local"
}
