#!/usr/bin/env node

const colors = require('colors/safe')
const commandLineCommands = require('command-line-commands')
const moment = require('moment')
const prompt = require('prompt')
const ThermSmart = require('../therm-smart')

const scan = () => {
  console.log(colors.gray('Scanning...'))
  console.log(colors.gray('Press Enter to stop scanning'))

  const stdin = process.stdin
  const stdinHandler = char => {
    if (char === '\u0003') {  // Ctrl+C
      process.exit()
    } else if (char === '\u000d') { // Enter
      stdin.setRawMode(false)
      stdin.removeListener('data', stdinHandler)

      ThermSmart.stopScan()
    } else {
      process.stdout.write(char)
    }
  }

  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding('utf-8')
  stdin.on('data', stdinHandler)

  let numDevices = 0

  const discoverHandler = device => {
    if (numDevices === 0) {
      console.log('')
      console.log('Found devices:')
    }

    const message = [
      colors.green(++numDevices),
      ': ',
      device.localName,
      ' (',
      device.address,
      ')'
    ]
    console.log(message.join(''))
  }

  return ThermSmart.scan(discoverHandler)
}

const selectDevice = devices => {
  return new Promise((resolve, reject) => {
    if (devices.length === 1) {
      console.log('')
      resolve(devices[0])
    } else if (devices.length > 1) {
      console.log('')
      prompt.start()
      prompt.message = ''
      prompt.get(
        [{
          name: 'device',
          description: colors.green('Select a device (1-' + devices.length + ')'),
          type: 'number',
        }],
        (err, result) => {
          if (!err) {
            const num = result.device
            if (num >= 1 && num <= devices.length) {
              resolve(devices[num - 1])
            } else {
              console.error(colors.red('Invalid number:'), num)
              process.exit(1)
            }
          }
        }
      )
    } else {
      process.exit()
    }
  })
}

const readTime = device => {
  console.log(colors.gray('Reading time...'))

  device.readTime().then(time => {
    console.log('Time:', moment(time).format('YYYY-MM-DD HH:mm:ss'))
    process.exit()
  })
}

const validCommands = [
  'read-time',
]
const { command } = commandLineCommands(validCommands.concat([null]))

if (command === null) {
  console.log('usage: manage.js <command>')
  console.log('')
  console.log('Valid commands are:', validCommands.join(', '))
  process.exit()
} else {
  let device = null

  scan()
    .then(selectDevice)
    .then((d) => {
      device = d
      console.log(colors.gray('Connecting...'))
      return device.connect()
    })
    .then(() => {
      if (command === 'read-time') {
        readTime(device)
      }
    })
    .catch(error => {
      console.error(colors.red('An error occurred:'), error)
      process.exit(1)
    })
}
