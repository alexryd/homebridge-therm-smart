const parseTemperature = (data, position) => {
  return (data.readUInt16LE(position) - 0x3000) / 20
}

const parseHumidity = (data, position) => {
  return parseInt(data.toString('hex', position, position + 1))
}

class Reading {
  static parseReadings(data) {
    const readings = []

    switch (data.readUInt16LE(0)) {
    case 0x1f00:
      readings.push(new Reading(
        'indoor',
        'temperature',
        parseTemperature(data, 2)
      ))
      readings.push(new Reading(
        'indoor',
        'humidity',
        parseHumidity(data, 8)
      ))
      break

    case 0x2f00:
      readings.push(new Reading(
        'outdoor',
        'temperature',
        parseTemperature(data, 2)
      ))
      break

    default:
      console.log('Unknown reading:', data)
    }

    return readings
  }

  constructor(sensor, type, value) {
    this.sensor = sensor
    this.type = type
    this.value = value
  }

  get symbol() {
    switch (this.type) {
    case 'temperature':
      return '°C'

    case 'humidity':
      return '%'
    }

    return null
  }
}

module.exports = Reading
