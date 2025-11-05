const form = document.getElementById("weather-form");
const cityInput = document.getElementById("city-input");
const statusMessage = document.getElementById("status-message");
const weatherCard = document.getElementById("weather-card");
const temperatureField = document.getElementById("temperature");
const humidityField = document.getElementById("humidity");
const rainChanceField = document.getElementById("rain-chance");
const seasonAdviceField = document.getElementById("season-advice");
const submitButton = form.querySelector(".weather-button");

const GEOCODING_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const city = cityInput.value.trim();
  weatherCard.hidden = true;
  statusMessage.textContent = "";

  if (!city) {
    statusMessage.textContent = "कृपया शहर का नाम दर्ज करें।";
    cityInput.focus();
    return;
  }

  setLoadingState(true);
  statusMessage.textContent = "मौसम जानकारी प्राप्त की जा रही है…";

  try {
    const location = await fetchLocation(city);
    const forecast = await fetchForecast(location);
    populateWeatherCard(forecast);
    statusMessage.textContent = `${location.name}, ${location.country} के लिए ताज़ा मौसम डेटा।`;
    weatherCard.hidden = false;
  } catch (error) {
    console.error(error);
    statusMessage.textContent = "क्षमा करें, मौसम जानकारी प्राप्त नहीं हो सकी। कृपया बाद में पुनः प्रयास करें।";
  } finally {
    setLoadingState(false);
  }
});

function setLoadingState(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "लोड हो रहा है…" : "Get Weather";
}

async function fetchLocation(city) {
  const params = new URLSearchParams({
    name: city,
    count: "1",
    language: "hi",
    format: "json",
  });

  const response = await fetch(`${GEOCODING_ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Geocoding request failed");
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error("City not found");
  }

  const [result] = data.results;

  return {
    latitude: result.latitude,
    longitude: result.longitude,
    name: result.name ?? city,
    country: result.country ?? "",
    timezone: result.timezone ?? "UTC",
  };
}

async function fetchForecast(location) {
  const params = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    current: "temperature_2m,relative_humidity_2m,precipitation",
    hourly: "precipitation_probability",
    forecast_days: "1",
    timezone: location.timezone,
  });

  const response = await fetch(`${FORECAST_ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Forecast request failed");
  }

  const data = await response.json();

  const rainChance =
    Array.isArray(data.hourly?.precipitation_probability) &&
    data.hourly.precipitation_probability.length
      ? averageNextSixHours(
          data.hourly.time,
          data.hourly.precipitation_probability,
          location.timezone
        )
      : data.current?.precipitation ?? 0;

  return {
    temperature: data.current?.temperature_2m ?? null,
    humidity: data.current?.relative_humidity_2m ?? null,
    rainChance,
    timezone: location.timezone,
  };
}

function averageNextSixHours(times, probabilities, timezone) {
  const now = new Date();
  const offsets = [];

  for (let i = 0; i < times.length; i += 1) {
    const parsed = parseDateWithTimezone(times[i], timezone);
    if (parsed >= now) {
      offsets.push(probabilities[i]);
    }
    if (offsets.length === 6) {
      break;
    }
  }

  if (!offsets.length) {
    return probabilities[probabilities.length - 1] ?? 0;
  }

  const sum = offsets.reduce((total, value) => total + Number(value || 0), 0);
  return Math.round(sum / offsets.length);
}

function parseDateWithTimezone(isoString, timezone) {
  const date = new Date(`${isoString}:00`);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(
    `${mapped.year}-${mapped.month}-${mapped.day}T${mapped.hour}:${mapped.minute}:00`
  );
}

function populateWeatherCard({ temperature, humidity, rainChance, timezone }) {
  const displayTemp = temperature ?? "--";
  const displayHumidity = humidity ?? "--";
  const displayRainChance = rainChance ?? "--";

  temperatureField.textContent =
    displayTemp === "--" ? "-- °C" : `${Math.round(displayTemp)} °C`;
  humidityField.textContent =
    displayHumidity === "--" ? "-- %" : `${Math.round(displayHumidity)} %`;
  rainChanceField.textContent =
    displayRainChance === "--" ? "-- %" : `${Math.round(displayRainChance)} %`;

  const advice = getSeasonAdvice(displayTemp, displayHumidity, displayRainChance, timezone);
  seasonAdviceField.textContent = advice;
}

function getSeasonAdvice(tempInput, humidityInput, rainChanceInput, timezone) {
  const now = new Date();
  const localeTime = timezone
    ? new Date(now.toLocaleString("en-US", { timeZone: timezone }))
    : now;
  const month = localeTime.getMonth() + 1;

  const temp = Number.isFinite(tempInput) ? Number(tempInput) : null;
  const humidity = Number.isFinite(humidityInput) ? Number(humidityInput) : null;
  const rainChance = Number.isFinite(rainChanceInput) ? Number(rainChanceInput) : null;

  const season =
    month >= 3 && month <= 5
      ? "वसंत से गर्मी"
      : month >= 6 && month <= 9
      ? "मानसून"
      : month === 10 || month === 11
      ? "शरद"
      : "ठंड का मौसम";

  const adviceParts = [`यह ${season} का दौर है।`];

  if (temp !== null) {
    if (temp >= 38) {
      adviceParts.push("तेज़ धूप से बचने के लिए हल्के कपड़े पहनें और पर्याप्त पानी पिएँ।");
    } else if (temp <= 10) {
      adviceParts.push("गरम कपड़े पहनें और ठंडी हवाओं से खुद को ढँक कर रखें।");
    } else if (temp >= 28) {
      adviceParts.push("हल्का और आरामदायक पहनावा चुनें तथा ठंडे पेय पदार्थ लें।");
    } else {
      adviceParts.push("तापमान आरामदायक है, सामान्य दिनचर्या जारी रखें।");
    }
  }

  if (humidity !== null) {
    if (humidity >= 75) {
      adviceParts.push("उच्च आर्द्रता के कारण पसीना अधिक हो सकता है, ठंडा रहने के उपाय करें।");
    } else if (humidity <= 35) {
      adviceParts.push("हवा शुष्क है, त्वचा को मॉइस्चराइज़ रखें और पानी पिएँ।");
    }
  }

  if (rainChance !== null) {
    if (rainChance >= 60) {
      adviceParts.push("बारिश की प्रबल संभावना है, छाता या रेनकोट साथ रखें।");
    } else if (rainChance >= 30) {
      adviceParts.push("हल्की फुहारें पड़ सकती हैं, सतर्क रहें।");
    } else {
      adviceParts.push("वर्षा की संभावना कम है, मौसम सुहाना रहेगा।");
    }
  }

  return adviceParts.join(" ");
}
