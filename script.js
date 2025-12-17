// ==== script.js – One DOMContentLoaded for everything ====
document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------------------------
  // 1. Navbar mobile toggle
  // -------------------------------------------------
  const toggle = document.querySelector('.nav-toggle');
  const menu   = document.querySelector('.nav-menu');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('active');
    });
  }

  // Close menu when a link is clicked (mobile)
  document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
      if (menu) menu.classList.remove('active');
    });
  });

  // -------------------------------------------------
  // 2. Footer year
  // -------------------------------------------------
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // -------------------------------------------------
  // 3. Lightbox (gallery page)
  // -------------------------------------------------
  const lightbox     = document.getElementById('lightbox');
  const lightboxImg  = document.getElementById('lightbox-img');
  const closeBtn     = document.querySelector('.lightbox-close');

  if (lightbox && lightboxImg && closeBtn) {
    // Open
    document.querySelectorAll('[data-lightbox]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const src = link.getAttribute('href');
        lightboxImg.src = src;
        lightbox.classList.add('active');
        document.body.classList.add('lightbox-open');
      });
    });

    // Close helpers
    const closeLightbox = () => {
      lightbox.classList.remove('active');
      document.body.classList.remove('lightbox-open');
      setTimeout(() => { lightboxImg.src = ''; }, 300);
    };

    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', e => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
      }
    });
  }

    // -------------------------------------------------
    // 4. Snowfall Tracker (fake data – instant response)
    // -------------------------------------------------
    const fetchBtn       = document.getElementById('fetch-btn');
    const results = document.getElementById('snowfall-results');
    const locationSelect = document.getElementById('location');

    if (fetchBtn && results && locationSelect) {
        // Fake data per region
        const fakeData = {
        slc:     { region: 'Salt Lake City', '24h': '6"', '48h': '10"', season: '98"' },
        seattle: { region: 'Seattle Area',   '24h': '3"', '48h': '7"',  season: '42"' },
        reno:    { region: 'Reno-Tahoe',     '24h': '9"', '48h': '18"', season: '132"' },
        denver:  { region: 'Denver Area',    '24h': '5"', '48h': '11"', season: '89"' }
        };

        const urls = {
            slc: {url: "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations?stationTriplets=%2A%3AUT%3ASNTL&countyNames=Salt%20Lake%2C%20Davis%2C%20Weber%2C%20Utah&elements=SNWD&durations=HOURLY&returnForecastPointMetadata=false&returnReservoirMetadata=false&returnStationElements=false&activeOnly=true"},
            seattle: {url: "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations?stationTriplets=%2A%3AWA%3ASNTL&stationNames=Stevens%20Pass%2C%20Olallie%20Meadows%2C%20Buckinghorse%2C%20Corral%20Pass%2C%20Paradise%2C%20White%20Pass%2A%2C%20Wells%20Creek%2C%20Rainy%20Pass&returnForecastPointMetadata=false&returnReservoirMetadata=false&returnStationElements=false&activeOnly=true"},
            reno: {url: "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations?stationTriplets=%2A%3ANV%3ASNTL%2C%20%2A%3ACA%3ASNTL&countyNames=Nevada%2C%20Placer%2C%20El%20Dorado%2C%20Alpine%2C%20Washoe&elements=SNWD&durations=HOURLY&returnForecastPointMetadata=false&returnReservoirMetadata=false&returnStationElements=false&activeOnly=true"},
            denver: {url: "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations?stationTriplets=%2A%3ACO%3ASNTL&countyNames=Jefferson%2C%20Clear%20Creek%2C%20Park%2C%20Summit%2C%20Eagle&elements=SNWD&durations=HOURLY&returnForecastPointMetadata=false&returnReservoirMetadata=false&returnStationElements=false&activeOnly=true"}
        };

        fetchBtn.addEventListener('click', () => {
        const loc = locationSelect.value;
        fetchSnowData(urls[loc].url);

        if (!loc) {
            results.innerHTML = '<p class="placeholder">Please select a region first."</p>';
            return;
        }

        const data = fakeData[loc];

        results.innerHTML = `
        `;
        });
    }
async function fetchSnowData(metadataURL) {
  try {
    const results = document.getElementById('snowfall-results');
    results.innerHTML = `<p class="placeholder">Loading stations…</p>`;

    // 1. Get the list of stations
    const metaResp = await fetch(metadataURL);
    if (!metaResp.ok) throw new Error(`Meta ${metaResp.status}`);
    const userData = await metaResp.json();

    // 2. Fetch snow depth for EVERY station (in parallel)
    const stationPromises = userData.map(async station => {
      const triplet   = station.stationTriplet;
      const name      = station.name;
      const elevation = station.elevation + ' ft.';

      const url = `https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data?` +
                  `stationTriplets=${encodeURIComponent(triplet)}` +
                  `&elements=SNWD&duration=HOURLY&beginDate=-48&endDate=0` +
                  `&periodRef=END&centralTendencyType=NONE` +
                  `&returnFlags=false&returnOriginalValues=false&returnSuspectData=false`;

      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(resp.status);
        const data = await resp.json();

        const values = data[0]?.data?.[0]?.values ?? [];
        const snowfall = getSnowfallData(values);

        return new Station(name, elevation, snowfall);
      } catch (e) {
        console.warn(`Failed ${name}:`, e);
        return new Station(name, elevation, -1); // mark error
      }
    });

    // 3. WAIT for all requests
    const unorderedStations = await Promise.all(stationPromises);

    // 4. Filter out errors (optional)
    const goodStations = unorderedStations.filter(s => s.snowfall >= 0);

    // 5. SORT (most snow first)
    goodStations.sort((a, b) => b.snowfall - a.snowfall);

    console.log('Ready to render →', goodStations);

    // 6. RENDER – NO async needed!
    results.innerHTML = '';   // clear loading text
    goodStations.forEach(station => {
      console.log('Rendering:', station.name);   // you’ll see this!
      results.innerHTML += `
        <div class="metric-card">
          <div class="metric-label">
            <div>${station.name}</div>
            <div class="verified">${station.elevation}</div>
          </div>
          <div class="metric-value">${station.snowfall}"</div>
        </div>`;
    });

    return goodStations;   // optional
  } catch (error) {
    console.error('Error:', error);
    const results = document.getElementById('snowfall-results');
    results.innerHTML = `<p class="placeholder">Error: ${error.message}</p>`;
  }
}

    function getSnowfallData(nonJsonData){
        try
        {
            if (nonJsonData.length == 0)
                return -2;
            var minValue = nonJsonData[0].value
            var maxValue = nonJsonData[0].value
            var change = 0;
            var previous = nonJsonData[0].value

            nonJsonData.forEach(v =>{
            
                if (v.value < minValue)
                    minValue = v.value;
                if (v.value > maxValue)
                {
                    maxValue = v.value;
                    change = maxValue - minValue;
                }
                if(v.value > previous + 10){
                    return 0;
                }
            })
            return change;
        }
        catch (e)
        {
            console.log(e)
            return -1;
        }
    }
});


class Station{
    name;
    elevation;
    snowfall;

    nameChanger = [
        {original: "Atwater", final: "Alta"},
        {original: "Farmington Lower", final: "Farmington Canyon"},
        {original: "Farmington", final: "Bountiful Peak"},
        {original: "Parrish Creek", final: "Parrish Creek"},
        {original: "Louis Meadow", final: "City Creek Canyon"},
        {original: "Parleys Upper", final: "Lambs Canyon"},
        {original: "Thaynes Canyon", final: "Park City - Thaynes Canyon"},
        {original: "Timpanogos Divide", final: "Sundance"},
        {original: "Dry Fork", final: "Oquirrh Mountains"},
        {original: "Santaquin Meadows", final: "Mt Nebo - North"},
        {original: "Payson RS", final: "Payson CG"},
        {original: "Clear Creek #2", final: "Soldier Summit"},
        {original: "Lightning Ridge", final: "Causey"},

        {original: "Fish Lake", final: "Alpine Lakes Wilderness - East"},
        {original: "Cougar Mountain", final: "Green River - North"},
        {original: "Grouse Camp", final: "Mission Ridge"},
        {original: "Trough", final: "Mission Ridge - East"},
        {original: "Skookum Creek", final: "Tolt River South"},
        {original: "Alpine Meadows", final: "Tolt River North"},
        {original: "Decline Creek", final: "Darrington Mountains"},
        {original: "Lynn Lake", final: "Green River - South"},
        {original: "Ollalie Meadows", final: "Alpental Mid Mountain"},
        {original: "Rex River", final: "Cedar River"},
        {original: "Meadows Pass", final: "Cedar River - Upper"},
        {original: "Sawmill Ridge", final: "Green River - Upper"},
    ];

    constructor(name, elevation, snowfall){
        this.name = name;
        this.elevation = elevation;
        this.snowfall = snowfall;
        this.nameChanger.forEach(pair =>{
            if(pair.original === name){
                this.name = pair.final;
            }
        })
    }

    get(name){
        return name;
    }

    get(elevation){
        return elevation;
    }

    get(snowfall){
        return snowfall;
    }
}


