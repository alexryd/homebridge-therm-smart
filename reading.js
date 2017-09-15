const TOO_HIGH = 224
const TOO_LOW = 225
const ERROR_VALUE = 254
const INVALID_VALUE = -999

const getError = (b) => {
  const errorValue = b & 0xf

  if ((b & 0xf0) === 0xf0) {
    if (errorValue === 0xf) {
      // Null value / no sensor
      return INVALID_VALUE
    } else if (errorValue === 0xe) {
      // Sensor error
      return ERROR_VALUE
    } else if (errorValue >= 0 && errorValue <= 9) {
      // Negative value, proceed
      return 0
    }
  } else if ((b & 0xf0) === 0xe0) {
    if (errorValue === 0) {
      // Value too high
      return TOO_HIGH
    } else if (errorValue === 1) {
      // Value too low
      return TOO_LOW
    } else {
      // Sensor out of range
      return INVALID_VALUE
    }
  }

  return 0
}

const parseTemperature = (data, position) => {
  const error = getError(data[position + 1])
  if (error !== 0) {
    return error
  }

  return Math.round((data.readUInt16LE(position) - 0x3000) / 2) / 10
}

const parseHumidity = (data, position) => {
  const error = getError(data[position])
  if (error !== 0) {
    return error
  }

  return parseInt(data.toString('hex', position, position + 1))
}

class Reading {
  static parseReadings(data) {
    const readings = []

    readings.push(new Reading(
      null,
      'battery-level',
      data[0]
    ))

    const typeByte = data[1]
    const dataType = (typeByte & 0xf0) >> 4
    const sensorType = typeByte & 0x7

    if (sensorType !== 1 && sensorType !== 3 && sensorType !== 4 && sensorType !== 7) {
      console.error('Invalid sensor type in data:', data)
      return readings
    }

    const addReading = (type, value) => {
      const sensor = dataType === 1 ? 'indoor' : dataType === 2 ? 'outdoor' : 'unknown'
      readings.push(new Reading(sensor, type, value))
    }

    addReading('temperature', parseTemperature(data, 2))
    addReading('maximum-temperature', parseTemperature(data, 4))
    addReading('minimum-temperature', parseTemperature(data, 6))

    if (dataType === 1 && data.length >= 11) {
      addReading('humidity', parseHumidity(data, 8))
      addReading('maximum-humidity', parseHumidity(data, 9))
      addReading('minimum-humidity', parseHumidity(data, 10))
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
    case 'maximum-temperature':
    case 'minimum-temperature':
      return '°C'

    case 'battery-level':
    case 'humidity':
    case 'maximum-humidity':
    case 'minimum-humidity':
      return '%'
    }

    return null
  }
}

module.exports = Reading
