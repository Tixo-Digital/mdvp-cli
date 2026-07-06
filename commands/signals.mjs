import { SIGNALS } from '../engine/signals/index.mjs'

function signalRows(signals = SIGNALS) {
  return signals.map((signal) => ({
    id: signal.id,
    label: signal.label,
    penalty: signal.penalty,
    weight: signal.weight ?? 1,
    rationale: signal.rationale,
  }))
}

function pad(value, width) {
  return String(value).padEnd(width)
}

function formatSignalsText(signals = signalRows()) {
  const rows = signals.map((signal) => ({
    ...signal,
    penalty: String(signal.penalty),
    weight: String(signal.weight),
  }))
  const idWidth = Math.max('id'.length, ...rows.map((row) => row.id.length))
  const labelWidth = Math.max('label'.length, ...rows.map((row) => row.label.length))
  const penaltyWidth = Math.max('penalty'.length, ...rows.map((row) => row.penalty.length))
  const weightWidth = Math.max('weight'.length, ...rows.map((row) => row.weight.length))

  return [
    '',
    `  ${rows.length} signal detectors`,
    '',
    `  ${pad('id', idWidth)}  ${pad('label', labelWidth)}  ${pad('penalty', penaltyWidth)}  ${pad('weight', weightWidth)}`,
    `  ${'-'.repeat(idWidth)}  ${'-'.repeat(labelWidth)}  ${'-'.repeat(penaltyWidth)}  ${'-'.repeat(weightWidth)}`,
    ...rows.map((row) => (
      `  ${pad(row.id, idWidth)}  ${pad(row.label, labelWidth)}  ${pad(row.penalty, penaltyWidth)}  ${pad(row.weight, weightWidth)}`
    )),
    '',
  ].join('\n')
}

async function cmdSignals(opts = {}) {
  const signals = signalRows()

  if (opts.json) {
    console.log(JSON.stringify(signals, null, 2))
    return signals
  }

  console.log(formatSignalsText(signals))
  return signals
}

export {
  cmdSignals,
  formatSignalsText,
  signalRows,
}
