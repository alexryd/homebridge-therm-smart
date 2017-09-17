const ThermSmart = require('./therm-smart')

module.exports = homebridge => {
  const Characteristic = homebridge.hap.Characteristic
  const Service = homebridge.hap.Service

  class ThermSmartAccessory {
    constructor(log, config) {
      this.log = log
      this.config = config
      this.characteristics = {}

      this.startScan()
    }

    startScan() {
      const readingHandler = reading => {
        let name = reading.type
        if (reading.sensor) {
          name = reading.sensor + '-' + name
        }

        if (this.characteristics.hasOwnProperty(name)) {
          const characteristic = this.characteristics[name]
          if (reading.value !== characteristic.value) {
            characteristic.setValue(reading.value)
          }
        }
      }

      const addresses = this.config.address
        ? [ this.config.address.toLowerCase().replace(/:/g, '') ]
        : null

      this.log('Scanning for sensor readings')

      ThermSmart.scanForReadings(readingHandler, addresses)
        .then(() => {
          this.log('Stopped scanning for sensor readings')
        })
        .catch(error => {
          this.log('An error occurred while scanning for sensor readings:', error)
        })
    }

    getBatteryService() {
      const service = new Service.BatteryService(this.config.name + ' Battery')

      this.characteristics['battery-level'] = service
        .getCharacteristic(Characteristic.BatteryLevel)

      service.setCharacteristic(
        Characteristic.ChargingState,
        Characteristic.ChargingState.NOT_CHARGING
      )

      return service
    }

    getIndoorTemperatureService() {
      const service = new Service.TemperatureSensor(
        this.config.name + (this.config.sensor === 'all' ? ' Indoor ' : ' ') + 'Temperature',
        'indoor'
      )

      this.characteristics['indoor-temperature'] = service
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({ minValue: -100 })

      return service
    }

    getRelativeHumidityService() {
      const service = new Service.HumiditySensor(
        this.config.name + (this.config.sensor === 'all' ? ' Indoor ' : ' ') + ' Humidity'
      )

      this.characteristics['indoor-humidity'] = service
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)

      return service
    }

    getOutdoorTemperatureService() {
      const service = new Service.TemperatureSensor(
        this.config.name + (this.config.sensor === 'all' ? ' Outdoor ' : ' ') + ' Temperature',
        'outdoor'
      )

      this.characteristics['outdoor-temperature'] = service
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({ minValue: -100 })

      return service
    }

    setLowBatteryStatus(services, { oldValue, newValue }) {
      const c = Characteristic.StatusLowBattery
      const status = newValue < 10 ? c.BATTERY_LEVEL_LOW : c.BATTERY_LEVEL_NORMAL

      for (const service of services) {
        service
          .getCharacteristic(Characteristic.StatusLowBattery)
          .setValue(status)
      }
    }

    getServices() {
      const services = [ this.getBatteryService() ]

      const sensor = this.config.sensor || 'all'
      if (sensor === 'indoor') {
        services.push(
          this.getIndoorTemperatureService(),
          this.getRelativeHumidityService()
        )
      } else if (sensor === 'outdoor') {
        services.push(this.getOutdoorTemperatureService())
      } else if (sensor === 'all') {
        services.push(
          this.getIndoorTemperatureService(),
          this.getRelativeHumidityService(),
          this.getOutdoorTemperatureService()
        )
      } else {
        this.log('Unknown sensor specified. Must be one of either "indoor", "outdoor" or "all".')
      }

      services[0].getCharacteristic(Characteristic.BatteryLevel)
        .on('change', this.setLowBatteryStatus.bind(this, services))

      return services
    }
  }

  homebridge.registerAccessory(
    'homebridge-therm-smart',
    'ThermSmart',
    ThermSmartAccessory
  )
}
