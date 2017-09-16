const ThermSmart = require('./therm-smart')

module.exports = homebridge => {
  const Characteristic = homebridge.hap.Characteristic
  const Service = homebridge.hap.Service

  class ThermSmartAccessory {
    constructor(log, config) {
      this.log = log
      this.config = config

      this.data = {
        'battery-level': 0,
        'indoor-temperature': 0,
        'indoor-humidity': 0,
        'outdoor-temperature': 0,
      }

      this.startScan()
    }

    startScan() {
      const readingHandler = reading => {
        let name = reading.type
        if (reading.sensor) {
          name = reading.sensor + '-' + name
        }

        if (this.data.hasOwnProperty(name)) {
          this.data[name] = reading.value
        }
      }

      const address = this.config.address
        ? this.config.address.toLowerCase().replace(/:/g, '')
        : null

      this.log('Scanning for sensor readings')

      ThermSmart.scanForReadings(readingHandler, address)
        .then(() => {
          this.log('Stopped scanning for sensor readings')
        })
        .catch(error => {
          this.log('An error occurred while scanning for sensor readings:', error)
        })
    }

    getBatteryLevel(callback) {
      callback(null, this.data['battery-level'])
    }

    getLowBatteryStatus(callback) {
      const batteryLevel = this.data['battery-level']
      const c = Characteristic.StatusLowBattery
      const status = batteryLevel < 10 ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL
      callback(null, status)
    }

    getBatteryService() {
      const service = new Service.BatteryService(
        this.config.batteryServiceName || this.config.name + ' Battery'
      )

      service
        .getCharacteristic(Characteristic.BatteryLevel)
        .on('get', this.getBatteryLevel.bind(this))

      service.setCharacteristic(
        Characteristic.ChargingState,
        Characteristic.ChargingState.NOT_CHARGING
      )

      return service
    }

    getIndoorTemperature(callback) {
      callback(null, this.data['indoor-temperature'])
    }

    getIndoorTemperatureService() {
      const service = new Service.TemperatureSensor(
        this.config.indoorTemperatureSensorName || this.config.name + ' Indoor Temperature',
        'indoor'
      )

      service
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({ minValue: -100 })
        .on('get', this.getIndoorTemperature.bind(this))

      return service
    }

    getRelativeHumidity(callback) {
      callback(null, this.data['indoor-humidity'])
    }

    getRelativeHumidityService() {
      const service = new Service.HumiditySensor(
        this.config.humiditySensorName || this.config.name + ' Humidity'
      )

      service
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getRelativeHumidity.bind(this))

      return service
    }

    getOutdoorTemperature(callback) {
      callback(null, this.data['outdoor-temperature'])
    }

    getOutdoorTemperatureService() {
      const service = new Service.TemperatureSensor(
        this.config.outdoorTemperatureSensorName || this.config.name + ' Outdoor Temperature',
        'outdoor'
      )

      service
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({ minValue: -100 })
        .on('get', this.getOutdoorTemperature.bind(this))

      return service
    }

    getServices() {
      const services = [
        this.getBatteryService(),
        this.getIndoorTemperatureService(),
        this.getRelativeHumidityService(),
        this.getOutdoorTemperatureService()
      ]

      for (const service of services) {
        service
          .getCharacteristic(Characteristic.StatusLowBattery)
          .on('get', this.getLowBatteryStatus.bind(this))
      }

      return services
    }
  }

  homebridge.registerAccessory(
    'homebridge-therm-smart',
    'ThermSmart',
    ThermSmartAccessory
  )
}
