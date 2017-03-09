const noble = require('noble')

const SERVICE_UUID = 'fff0'
const WRITE_CHARACTERISTIC_UUID = 'fff3'
const NOTIFY_CHARACTERISTIC_UUID = 'fff4'

const readTemperature = (data, position) => {
  return (data.readUInt16LE(position) - 0x3000) / 20
}

class ThermSmartSensor {
  constructor(address=null) {
    this.address = address
    this.peripheral = null
    this.writeCharacteristic = null
    this.notifyCharacteristic = null
    this.data = null
  }

  isPoweredOn() {
    if (noble.state === 'poweredOn') {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const stateChangeHandler = state => {
        if (state === 'poweredOn') {
          noble.removeListener('stateChange', stateChangeHandler)
          resolve()
        }
      }
      noble.on('stateChange', stateChangeHandler)
    })
  }

  scan() {
    return this.isPoweredOn().then(() => {
      if (this.peripheral !== null) {
        return Promise.resolve(this.peripheral)
      }

      return new Promise((resolve, reject) => {
        const discoverHandler = peripheral => {
          if (this.address === null || this.address === peripheral.address) {
            this.peripheral = peripheral
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

  connect() {
    return this.scan().then(peripheral => {
      if (peripheral.state === 'connected') {
        return Promise.resolve(peripheral)
      }

      return new Promise((resolve, reject) => {
        peripheral.connect(error => {
          if (error) {
            reject('Failed to connect to sensor: ' + error)
            return
          }

          peripheral.discoverSomeServicesAndCharacteristics(
            [SERVICE_UUID],
            [WRITE_CHARACTERISTIC_UUID, NOTIFY_CHARACTERISTIC_UUID],
            (error2, services, characteristics) => {
              if (error2) {
                reject('Failed to discover services and characteristics: ' + error2)
                return
              }

              characteristics.forEach(characteristic => {
                if (characteristic.uuid === WRITE_CHARACTERISTIC_UUID) {
                  this.writeCharacteristic = characteristic
                } else if (characteristic.uuid === NOTIFY_CHARACTERISTIC_UUID) {
                  this.notifyCharacteristic = characteristic
                }
              })

              this.notifyCharacteristic.subscribe(error3 => {
                if (error3) {
                  reject('Failed to subscribe to characteristic: ' + error3)
                  return
                }

                resolve(peripheral)
              })
            }
          )
        })
      })
    })
  }

  update() {
    return this.connect().then(() => {
      if (this.data !== null) {
        return Promise.resolve(this.data)
      }

      return new Promise((resolve, reject) => {
        const dataHandler = (data, isNotification) => {
          if (isNotification && data.readUInt8(0) === 0xd2) {
            this.data = data
            this.notifyCharacteristic.removeListener('data', dataHandler)
            resolve(data)
          }
        }

        this.notifyCharacteristic.on('data', dataHandler)

        const command = new Buffer([0xd2])
        this.writeCharacteristic.write(command, false, error => {
          if (error) {
            this.notifyCharacteristic.removeListener('data', dataHandler)
            reject('Failed to write to characteristic: ' + error)
          }
        })
      })
    })
  }

  getIndoorTemperature() {
    return this.update().then(data => {
      return readTemperature(data, 3)
    })
  }

  getOutdoorTemperature() {
    return this.update().then(data => {
      return readTemperature(data, 12)
    })
  }
}

module.exports = ThermSmartSensor
