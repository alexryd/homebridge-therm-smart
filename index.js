const packageVersion = require('./package.json').version
const ThermSmart = require('./therm-smart')

module.exports = homebridge => {
  const Accessory = homebridge.platformAccessory
  const Characteristic = homebridge.hap.Characteristic
  const Service = homebridge.hap.Service
  const UUIDGen = homebridge.hap.uuid

  class ThermSmartPlatform {
    constructor(log, config, api) {
      this.log = log
      this.config = config
      this.api = api
      this.accessories = []

      this.api.on('didFinishLaunching', () => {
        this.scan()
      })
    }

    configureAccessory(accessory) {
      accessory.reachable = true

      accessory.getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.FirmwareRevision, packageVersion)

      this.accessories.push(accessory)
    }

    addAccessory(type, address) {
      if (!type || !address) {
        throw new Error('Accessory must have a type and an address')
      }

      const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1)
      const name = `ThermSmart ${capitalizedType} sensor`
      const uuid = UUIDGen.generate(name)
      const accessory = new Accessory(name, uuid)
      const ctx = accessory.context

      ctx.type = type
      ctx.address = address

      accessory.addService(Service.TemperatureSensor, name + ' temperature')
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({ minValue: -100 })

      if (type === 'indoor') {
        accessory.addService(Service.HumiditySensor, name + ' humidity')
      }

      accessory.addService(Service.BatteryService, name + ' battery')
        .setCharacteristic(
          Characteristic.ChargingState,
          Characteristic.ChargingState.NOT_CHARGING
        )

      accessory.getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, 'ThermSmart')
        .setCharacteristic(Characteristic.Model, `${capitalizedType} sensor`)
        .setCharacteristic(Characteristic.SerialNumber, address)
        .setCharacteristic(Characteristic.FirmwareRevision, packageVersion)

      this.accessories.push(accessory)
      this.api.registerPlatformAccessories('homebridge-therm-smart', 'ThermSmart', [accessory])

      return accessory
    }

    getAccessory(type, address) {
      for (let accessory of this.accessories) {
        const ctx = accessory.context
        if (ctx.type === type && ctx.address === address) {
          return accessory
        }
      }
      return null
    }

    readingHandler(reading, peripheral) {
      const address = peripheral.address
      if (!address) {
        return
      }

      if (!reading.sensor) {
        if (reading.type === 'battery-level') {
          const level = reading.value
          const SLB = Characteristic.StatusLowBattery
          const status = level < 10 ? SLB.BATTERY_LEVEL_LOW : SLB.BATTERY_LEVEL_NORMAL

          for (let accessory of this.accessories) {
            if (accessory.context.address === address) {
              const service = accessory.getService(Service.BatteryService)
              service.getCharacteristic(Characteristic.BatteryLevel).setValue(level)
              service.getCharacteristic(SLB).setValue(status)
            }
          }
        }
      } else {
        if (reading.type !== 'temperature' && reading.type !== 'humidity') {
          return
        }

        let accessory = this.getAccessory(reading.sensor, address)
        if (!accessory) {
          accessory = this.addAccessory(reading.sensor, address)
        }

        if (reading.type === 'temperature') {
          accessory.getService(Service.TemperatureSensor)
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setValue(reading.value)
        } else if (reading.type === 'humidity') {
          accessory.getService(Service.HumiditySensor)
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .setValue(reading.value)
        }
      }
    }

    scan() {
      const addresses = this.config.address
        ? [ this.config.address.toLowerCase().replace(/:/g, '') ]
        : null

      this.log('Scanning for sensor readings')

      ThermSmart.scanForReadings(this.readingHandler.bind(this), addresses)
        .then(() => {
          this.log('Stopped scanning for sensor readings')
        })
        .catch(error => {
          this.log('An error occurred while scanning for sensor readings:', error)
        })
    }
  }

  homebridge.registerPlatform(
    'homebridge-therm-smart',
    'ThermSmart',
    ThermSmartPlatform,
    true
  )
}
