const LABELS = {
  static: "static audit",
  local: "local crawl",
  swarm: "local + swarm submit",
  cloud: "cloud lookup",
}

export function sourceLabel(source) {
  return LABELS[source] ?? source
}
