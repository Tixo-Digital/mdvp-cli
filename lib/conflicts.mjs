export function checkConflicts(opts, conflicts) {
  for (const { pair, msg } of conflicts) {
    if (opts[pair[0]] && opts[pair[1]]) return msg
  }
  return null
}
