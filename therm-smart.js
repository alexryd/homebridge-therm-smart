const EventEmitter = require('events')
const noble = require('noble')
const Reading = require('./reading')

const COMPANY_ID = 0x4842

const SERVICE_UUID = 'fff0'

const WRITE_CHARACTERISTIC_UUID = 'fff3'
const NOTIFY_CHARACTERISTIC_UUID = 'fff4'

class ThermSmart extends EventEmitter {
  static powerOn() {
    if (noble.state === 'poweredOn') {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        noble.removeListener('stateChange', stateChangeHandler)
        reject(new Error('Timeout while waiting for power on (state: ' + noble.state + ')'))
      }, 5000)

      const stateChangeHandler = state => {
        if (state === 'poweredOn') {
          clearTimeout(timeout)
          noble.removeListener('stateChange', stateChangeHandler)
          resolve()
        }
      }

      noble.on('stateChange', stateChangeHandler)
    })
  }

  static scan(discoverHandler, addresses) {
    return ThermSmart.powerOn().then(() => {
      return new Promise((resolve, reject) => {
        const sensors = []

        const _discoverHandler = peripheral => {
          const address = peripheral.address && peripheral.address.replace(/:/g, '')
          if (addresses && addresses.indexOf(address) === -1) {
            return
          }

          const sensor = new ThermSmart(peripheral)
          sensors.push(sensor)

          if (discoverHandler) {
            discoverHandler.call(this, sensor)
          }
        }

        const scanStopHandler = () => {
          resolve(sensors)
        }

        const stateChangeHandler = state => {
          if (state !== 'poweredOn') {
            noble.removeListener('discover', _discoverHandler)
            noble.removeListener('scanStop', scanStopHandler)
            noble.removeListener('stateChange', stateChangeHandler)
            noble.stopScanning()
            reject(new Error('State changed to ' + state))
          }
        }

        noble.startScanning([SERVICE_UUID], false, error => {
          if (error) {
            reject(error)
            return
          }

          noble.on('discover', _discoverHandler)
          noble.on('scanStop', scanStopHandler)
          noble.on('stateChange', stateChangeHandler)
        })
      })
    })
  }

  static scanForReadings(readingHandler, addresses) {
    return ThermSmart.powerOn().then(() => {
      return new Promise((resolve, reject) => {
        const discoverHandler = peripheral => {
          const data = peripheral.advertisement.manufacturerData
          if (data.length < 9 || data.readUInt16LE(0) !== COMPANY_ID) {
            return
          }

          const address = peripheral.address && peripheral.address.replace(/:/g, '')
          if (address && data.readUIntLE(2, 6).toString(16) !== address) {
            // Seems like the advertisement data always starts with the address
            // in little endian, so we use that as an additional check here
            return
          }

          if (addresses && addresses.indexOf(address) === -1) {
            return
          }

          if (readingHandler) {
            for (const reading of Reading.parseReadings(data.slice(8))) {
              readingHandler.call(this, reading, peripheral)
            }
          }
        }

        const scanStopHandler = () => {
          resolve()
        }

        const stateChangeHandler = state => {
          if (state !== 'poweredOn') {
            noble.removeListener('discover', discoverHandler)
            noble.removeListener('scanStop', scanStopHandler)
            noble.removeListener('stateChange', stateChangeHandler)
            noble.stopScanning()
            reject(new Error('State changed to ' + state))
          }
        }

        noble.startScanning([SERVICE_UUID], true, error => {
          if (error) {
            reject(error)
            return
          }

          noble.on('discover', discoverHandler)
          noble.on('scanStop', scanStopHandler)
          noble.on('stateChange', stateChangeHandler)
        })
      })
    })
  }

  static stopScan() {
    return new Promise((resolve, reject) => {
      noble.stopScanning(() => {
        resolve()
      })
    })
  }

  constructor(peripheral) {
    super()
    this.peripheral = peripheral
    this.id = peripheral.id
    this.address = peripheral.address
    this.localName = peripheral.advertisement.localName
  }

  connect() {
    this.emit('connecting')

    return new Promise((resolve, reject) => {
      if (this.peripheral.state === 'connected') {
        resolve()
        return
      }

      this.peripheral.connect(error => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    }).then(() => {
      return this._getCharacteristics()
    }).then(() => {
      return this._setupListeners()
    }).then(() => {
      this.emit('connected')
    })
  }

  _getCharacteristics() {
    return new Promise((resolve, reject) => {
      const disconnectHandler = () => {
        reject(new Error('Peripheral disconnected unexpectedly'))
      }
      this.peripheral.once('disconnect', disconnectHandler)

      this.peripheral.discoverSomeServicesAndCharacteristics(
        [SERVICE_UUID],
        [],
        (error, services, characteristics) => {
          this.peripheral.removeListener('disconnect', disconnectHandler)

          if (error) {
            reject(error)
          } else {
            this.writeCharacteristic = characteristics.find(
              c => c.uuid === WRITE_CHARACTERISTIC_UUID
            )
            this.notifyCharacteristic = characteristics.find(
              c => c.uuid === NOTIFY_CHARACTERISTIC_UUID
            )

            resolve()
          }
        }
      )
    })
  }

  _setupListeners() {
    return new Promise((resolve, reject) => {
      const disconnectHandler = () => {
        reject(new Error('Peripheral disconnected unexpectedly'))
      }
      this.peripheral.once('disconnect', disconnectHandler)

      this.notifyCharacteristic.subscribe(error => {
        this.peripheral.removeListener('disconnect', disconnectHandler)
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  write(data, responseCommand) {
    return new Promise((resolve, reject) => {
      const dataHandler = (receivedData, isNotification) => {
        if (isNotification && receivedData.readUInt8(0) === responseCommand) {
          this.notifyCharacteristic.removeListener('data', dataHandler)
          resolve(receivedData)
        }
      }
      this.notifyCharacteristic.on('data', dataHandler)

      this.writeCharacteristic.write(data, false, error => {
        this.emit('write', data, error)
        if (error) {
          this.notifyCharacteristic.removeListener('data', dataHandler)
          reject(error)
        }
      })
    })
  }
}

module.exports = ThermSmart
