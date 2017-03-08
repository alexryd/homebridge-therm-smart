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

  scan(address=null) {
    return ThermSmart.isPoweredOn().then(() => {
      return new Promise((resolve, reject) => {
        const discoverHandler = peripheral => {
          if (address === null || address === peripheral.address) {
            noble.removeListener('discover', discoverHandler)
            noble.removeListener('stateChange', stateChangeHandler)
            noble.stopScanning()
            resolve(peripheral)
          } else {
            console.log('Skipping sensor with address', peripheral.address)
          }
        }

        const stateChangeHandler = state => {
          if (state !== 'poweredOn') {
            noble.removeListener('discover', discoverHandler)
            noble.removeListener('stateChange', stateChangeHandler)
            noble.stopScanning()
            reject('State is no longer poweredOn (' + state + ')')
          }
        }

        noble.startScanning([SERVICE_UUID], true, error => {
          if (error) {
            reject('Failed to scan for sensors: ' + error)
            return
          }

          noble.on('discover', discoverHandler)
          noble.on('stateChange', stateChangeHandler)
        })
      })
    })
  }
}

module.exports = ThermSmart
