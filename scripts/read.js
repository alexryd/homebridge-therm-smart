#!/usr/bin/env node

const colors = require('colors/safe')
const commandLineArgs = require('command-line-args')
const ThermSmart = require('../therm-smart')

const { addresses, fieldName, format, help, timeout } = commandLineArgs([
  { name: 'addresses', type: String, multiple: true, defaultOption: true },
  { name: 'fieldName', type: String, defaultValue: 'value' },
  { name: 'format', alias: 'f', type: String, defaultValue: 'json' },
  { name: 'help', alias: 'h', type: Boolean },
  { name: 'timeout', alias: 't', type: Number, defaultValue: 5000 },
])

if (help) {
  console.log('usage: read.js [options] [<addresses>]')
  console.log('')
  console.log('Options:')
  console.log(
    '--fieldName: Used with the influxdb format to specify the field name'
  )
  console.log('--format: Output format (available formats: influxdb, json)')
  console.log('--timeout: Read timeout, in milliseconds')
  process.exit()
}

if (format !== 'influxdb' && format !== 'json') {
  console.error(colors.red('Invalid format:'), format)
  process.exit(1)
}

const READINGS = [
  'indoor-temperature',
  'indoor-humidity',
  'outdoor-temperature',
]

const readings = new Map()

const readingHandler = reading => {
  let key = reading.type
  if (reading.sensor) {
    key = reading.sensor + '-' + key
  }

  if (READINGS.indexOf(key) === -1) {
    return
  }

  readings.set(key, reading)

  for (const r of READINGS) {
    if (!readings.has(r)) {
      return
    }
  }

  done()
}

const done = () => {
  clearTimeout(readTimeout)
  ThermSmart.stopScan()

  if (format === 'influxdb') {
    for (const r of readings.values()) {
      console.log(`${r.type},sensor=${r.sensor} ${fieldName}=${r.value}`)
    }
  } else if (format === 'json') {
    console.log(JSON.stringify(Array.from(readings.values())))
  }

  process.exit()
}

const normAddresses = addresses && addresses.map(
  address => address.toLowerCase().replace(/:/g, '')
)

const readTimeout = setTimeout(() => {
  ThermSmart.stopScan()
}, timeout)

ThermSmart.scanForReadings(readingHandler, normAddresses)
  .then(done)
  .catch(error => {
    console.error(colors.red('An error occurred:'), error)
    process.exit(1)
  })
