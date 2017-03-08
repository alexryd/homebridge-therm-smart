const noble = require('noble')

const SERVICE_UUID = 'fff0'

const ThermSmart = {
  isPoweredOn() {
    return new Promise((resolve, reject) => {
      if (noble.state === 'poweredOn') {
        resolve()
      } else {
        const stateChangeHandler = state => {
          if (state === 'poweredOn') {
            noble.removeListener('stateChange', stateChangeHandler)
            resolve()
          }
        }
        noble.on('stateChange', stateChangeHandler)
      }
    })
  },

  scan() {
    return ThermSmart.isPoweredOn().then(() => {
      return new Promise((resolve, reject) => {
        const discoverHandler = peripheral => {
          noble.removeListener('discover', discoverHandler)
          noble.removeListener('stateChange', stateChangeHandler)
          noble.stopScanning()
          resolve(peripheral)
        }
        const stateChangeHandler = state => {
          if (state !== 'poweredOn') {
            noble.removeListener('discover', discoverHandler)
            noble.removeListener('stateChange', stateChangeHandler)
            noble.stopScanning()
            reject('State is no longer poweredOn (' + state + ')')
          }
        }

        noble.on('discover', discoverHandler)
        noble.on('stateChange', stateChangeHandler)

        noble.startScanning([SERVICE_UUID], true)
      })
    })
  }
}

module.exports = ThermSmart
