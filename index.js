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
        this.config.indoorTemperatureSensorName || this.config.name + ' Indoor Temperature',
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
      const service = new homebridge.hap.Service.HumiditySensor(
        this.config.humiditySensorName || this.config.name + ' Humidity'
      )

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
        this.config.outdoorTemperatureSensorName || this.config.name + ' Outdoor Temperature',
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
