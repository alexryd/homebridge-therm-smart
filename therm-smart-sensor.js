const noble = require('noble')

const SERVICE_UUID = 'fff0'
const WRITE_CHARACTERISTIC_UUID = 'fff3'
const NOTIFY_CHARACTERISTIC_UUID = 'fff4'

const GET_SENSOR_DATA_COMMAND = 0xd2

const readTemperature = (data, position) => {
  return (data.readUInt16LE(position) - 0x3000) / 20
}

const readRelativeHumidity = (data, position) => {
  return parseInt(data.toString('hex', position, position + 1))
}

class BluetoothSensor {
  constructor(config, log) {
    this.log = log || console.log
    this.address = config.address || null
    this.peripheral = null
  }

  bluetoothIsPoweredOn() {
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
      this.log('Waiting for Bluetooth device to power on...')
    })
  }

  scan() {
    return this.bluetoothIsPoweredOn().then(() => {
      if (this.peripheral !== null) {
        return this.peripheral
      }

      return new Promise((resolve, reject) => {
        const discoverHandler = peripheral => {
          if (this.address === null || this.address === peripheral.address) {
            this.peripheral = peripheral
            peripheral.once('disconnect', this.handleDisconnect.bind(this))

            noble.removeListener('discover', discoverHandler)
            noble.removeListener('stateChange', stateChangeHandler)
            noble.stopScanning()

            this.log('Found sensor with address', peripheral.address)
            resolve(peripheral)
          } else {
            this.log('Skipping sensor with address', peripheral.address)
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
          this.log('Scanning for sensors...')
        })
      })
    })
  }

  connect() {
    return this.scan().then(peripheral => {
      if (peripheral.state === 'connected') {
        return peripheral
      }

      return new Promise((resolve, reject) => {
        this.log('Connecting to sensor...')
        peripheral.connect(error => {
          if (error) {
            reject('Failed to connect to sensor: ' + error)
            return
          }

          this.log('Sensor connected')
          resolve(peripheral)
        })
      })
    })
  }

  disconnect() {
    if (this.peripheral === null) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      this.peripheral.disconnect(error => {
        if (error) {
          reject('Failed to disconnect from sensor: ' + error)
          return
        }

        resolve()
      })
    })
  }

  handleDisconnect() {
    this.log('Sensor was disconnected')
    this.peripheral = null
  }
}

class ThermSmartSensor extends BluetoothSensor {
  constructor(config=null, log=null) {
    const c = config || {}

    super(config, log)

    this.isConnected = false
    this.writeCharacteristic = null
    this.notifyCharacteristic = null
    this.loadSensorDataPromise = null
    this.sensorData = null
    this.sensorDataLoadedAt = 0
    this.dataTtl = c.dataTtl || 15
  }

  connect() {
    if (this.isConnected) {
      return Promise.resolve()
    }

    return super.connect().then(peripheral => {
      return new Promise((resolve, reject) => {
        const disconnectHandler = () => {
          reject('Sensor disconnected unexpectedly')
        }
        peripheral.once('disconnect', disconnectHandler)

        this.log('Discovering characteristics...')
        peripheral.discoverSomeServicesAndCharacteristics(
          [SERVICE_UUID],
          [WRITE_CHARACTERISTIC_UUID, NOTIFY_CHARACTERISTIC_UUID],
          (error, services, characteristics) => {
            if (error) {
              peripheral.removeListener('disconnect', disconnectHandler)
              reject('Failed to discover characteristics: ' + error)
              return
            }

            characteristics.forEach(characteristic => {
              if (characteristic.uuid === WRITE_CHARACTERISTIC_UUID) {
                this.writeCharacteristic = characteristic
              } else if (characteristic.uuid === NOTIFY_CHARACTERISTIC_UUID) {
                this.notifyCharacteristic = characteristic
              }
            })

            this.log('Subscribing to notifications...')
            this.notifyCharacteristic.subscribe(error2 => {
              peripheral.removeListener('disconnect', disconnectHandler)

              if (error2) {
                reject('Failed to subscribe to notifications: ' + error2)
                return
              }

              this.log('Subscribed to notifications')
              this.isConnected = true
              resolve()
            })
          }
        )
      })
    })
  }

  handleDisconnect() {
    super.handleDisconnect()

    this.isConnected = false
    this.writeCharacteristic = null
    this.notifyCharacteristic = null
    this.setSensorData(null)
  }

  loadSensorData() {
    if (this.loadSensorDataPromise !== null) {
      return this.loadSensorDataPromise
    }

    this.loadSensorDataPromise = this.connect().then(() => {
      if (this.getSensorData() !== null) {
        this.loadSensorDataPromise = null
        return this.getSensorData()
      }

      return new Promise((resolve, reject) => {
        const dataHandler = (data, isNotification) => {
          if (isNotification && data.readUInt8(0) === GET_SENSOR_DATA_COMMAND) {
            this.setSensorData(data)
            this.notifyCharacteristic.removeListener('data', dataHandler)
            this.loadSensorDataPromise = null
            this.log('Sensor data loaded')
            resolve(data)
          }
        }

        this.notifyCharacteristic.on('data', dataHandler)

        this.log('Loading sensor data...')
        const command = new Buffer([GET_SENSOR_DATA_COMMAND])
        this.writeCharacteristic.write(command, false, error => {
          if (error) {
            this.notifyCharacteristic.removeListener('data', dataHandler)
            this.loadSensorDataPromise = null
            reject('Failed to write to characteristic: ' + error)
          }
        })
      })
    }).catch(reason => {
      this.loadSensorDataPromise = null
      return Promise.reject(reason)
    })

    return this.loadSensorDataPromise
  }

  setSensorData(data) {
    this.sensorData = data
    this.sensorDataLoadedAt = new Date().getTime()
  }

  getSensorData() {
    if ((new Date().getTime() - this.sensorDataLoadedAt) / 1000 > this.dataTtl) {
      return null
    }

    return this.sensorData
  }

  getIndoorTemperature() {
    return this.loadSensorData().then(data => {
      return readTemperature(data, 3)
    })
  }

  getRelativeHumidity() {
    return this.loadSensorData().then(data => {
      return readRelativeHumidity(data, 9)
    })
  }

  getOutdoorTemperature() {
    return this.loadSensorData().then(data => {
      return readTemperature(data, 12)
    })
  }
}

module.exports = ThermSmartSensor
