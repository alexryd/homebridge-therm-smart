const ThermSmartSensor = require('./therm-smart-sensor')

module.exports = homebridge => {
  class ThermSmartSensorAccessory {
    constructor(log, config) {
      this.log = log
      this.config = config
      this.sensor = new ThermSmartSensor(config, log)
    }

    getIndoorTemperature(callback) {
      this.sensor.getIndoorTemperature()
        .then(temperature => {
          callback(null, temperature)
        })
        .catch(error => {
          callback(error)
        })
    }

    getIndoorTemperatureService() {
      const service = new homebridge.hap.Service.TemperatureSensor(
        this.config.name,
        'indoor'
      )

      service
        .getCharacteristic(homebridge.hap.Characteristic.CurrentTemperature)
        .on('get', this.getIndoorTemperature.bind(this))

      return service
    }

    getRelativeHumidity(callback) {
      this.sensor.getRelativeHumidity()
        .then(humidity => {
          callback(null, humidity)
        })
        .catch(error => {
          callback(error)
        })
    }

    getRelativeHumidityService() {
      const service = new homebridge.hap.Service.HumiditySensor(this.config.name)

      service
        .getCharacteristic(homebridge.hap.Characteristic.CurrentRelativeHumidity)
        .on('get', this.getRelativeHumidity.bind(this))

      return service
    }

    getOutdoorTemperature(callback) {
      this.sensor.getOutdoorTemperature()
        .then(temperature => {
          callback(null, temperature)
        })
        .catch(error => {
          callback(error)
        })
    }

    getOutdoorTemperatureService() {
      const service = new homebridge.hap.Service.TemperatureSensor(
        this.config.name,
        'outdoor'
      )

      service
        .getCharacteristic(homebridge.hap.Characteristic.CurrentTemperature)
        .on('get', this.getOutdoorTemperature.bind(this))

      return service
    }

    getServices() {
      return [
        this.getIndoorTemperatureService(),
        this.getRelativeHumidityService(),
        this.getOutdoorTemperatureService()
      ]
    }
  }

  homebridge.registerAccessory(
    'homebridge-thermsmart-sensor',
    'ThermSmartSensor',
    ThermSmartSensorAccessory
  )
}
