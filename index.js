const ThermSmartSensor = require('./therm-smart-sensor')

module.exports = homebridge => {
  const Characteristic = homebridge.hap.Characteristic
  const Service = homebridge.hap.Service

  class ThermSmartSensorAccessory {
    constructor(log, config) {
      this.log = log
      this.config = config
      this.sensor = new ThermSmartSensor(config, log)
    }

    getBatteryLevel(callback) {
      this.sensor.getBatteryLevel()
        .then(level => {
          callback(null, level)
        })
        .catch(error => {
          callback(error)
        })
    }

    getLowBatteryStatus(callback) {
      this.sensor.getBatteryLevel()
        .then(level => {
          const c = Characteristic.StatusLowBattery
          const status = level < 10 ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL
          callback(null, status)
        })
        .catch(error => {
          callback(error)
        })
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
      this.sensor.getIndoorTemperature()
        .then(temperature => {
          callback(null, temperature)
        })
        .catch(error => {
          callback(error)
        })
    }

    getIndoorTemperatureService() {
      const service = new Service.TemperatureSensor(
        this.config.indoorTemperatureSensorName || this.config.name + ' Indoor Temperature',
        'indoor'
      )

      service
        .getCharacteristic(Characteristic.CurrentTemperature)
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
      const service = new Service.HumiditySensor(
        this.config.humiditySensorName || this.config.name + ' Humidity'
      )

      service
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
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
      const service = new Service.TemperatureSensor(
        this.config.outdoorTemperatureSensorName || this.config.name + ' Outdoor Temperature',
        'outdoor'
      )

      service
        .getCharacteristic(Characteristic.CurrentTemperature)
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
    'homebridge-thermsmart-sensor',
    'ThermSmartSensor',
    ThermSmartSensorAccessory
  )
}
