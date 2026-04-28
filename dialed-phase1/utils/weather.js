// Open-Meteo weather API (free, no auth needed)
// Palmer Park Detroit: 42.3314, -83.0458

export const getWeather = async (lat, lon) => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`
    
    const res = await fetch(url)
    const data = await res.json()
    
    if (!data.current) return null
    
    const current = data.current
    return {
      temp: Math.round(current.temperature_2m),
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      windDirection: current.wind_direction_10m,
      weatherCode: current.weather_code,
      description: getWeatherDescription(current.weather_code),
    }
  } catch (e) {
    console.error('Weather fetch failed:', e)
    return null
  }
}

// WMO Weather interpretation codes
const getWeatherDescription = (code) => {
  const descriptions = {
    0: 'Clear',
    1: 'Mostly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Foggy',
    51: 'Light Drizzle',
    53: 'Moderate Drizzle',
    55: 'Heavy Drizzle',
    61: 'Light Rain',
    63: 'Moderate Rain',
    65: 'Heavy Rain',
    71: 'Light Snow',
    73: 'Moderate Snow',
    75: 'Heavy Snow',
    80: 'Light Showers',
    81: 'Moderate Showers',
    82: 'Heavy Showers',
    85: 'Light Snow Showers',
    86: 'Heavy Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm (hail)',
    99: 'Thunderstorm (hail)',
  }
  return descriptions[code] || 'Unknown'
}
