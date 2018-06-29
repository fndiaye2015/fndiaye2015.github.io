const BASE_URL = 'https://free.currencyconverterapi.com';
const LIST_OF_COUNTRIES = '/api/v5/countries';
const CONVERT = `/api/v5/convert?q=`;

const defaultCountry = '';
const defaultCurrency = '';
const defaultAmount = 0;

let localIndexStorage
let countriesWithCurrencies = [];
let fromCountryInput,
    fromAmountInput,
    fromCurrencySymbol,
    toCountryInput,
    toAmountInput,
    toCurrencySymbol,
    resetButton,
    message,
    errorMessage,
    successMessage,
    alert,
    refreshButton,
    dismissButton;


window.onload = () => {
  fromCountryInput = document.getElementById('inputFromCountry');
  fromAmountInput = document.getElementById('inputFromAmount');
  fromCurrencySymbol = document.getElementById('fromCurrencySymbol');

  toCountryInput = document.getElementById('inputToCountry');
  toAmountInput = document.getElementById('inputToAmount');
  toCurrencySymbol = document.getElementById('toCurrencySymbol');

  resetButton = document.getElementById('reset');
  message = document.getElementById('message');
  errorMessage = document.getElementById('error-message');
  successMessage = document.getElementById('success-message');
  alert = document.getElementById('alert');
  alert.style.display = 'none';

  fromCountryInput.addEventListener('change', handleChange);
  fromAmountInput.addEventListener('input', handleChange);

  toCountryInput.addEventListener('change', handleChange);
  toAmountInput.addEventListener('input', handleChange);

  resetButton.addEventListener('click', handleChange);

  MainController.registerServiceWorker();
  openDatabase();
  fetchCountries();
  restoreLastSession();
};

const restoreLastSession = () => {
  localIndexStorage.open()
    .then(idb => localIndexStorage.getItem('last-session', idb))
    .then(session => {
      if (!session) return;
      const { value } = session;
      const {
        fromCountry=defaultCountry,
        fromAmount=defaultAmount,
        fromSymbol='#',
        toCountry=defaultCountry,
        toAmount=defaultAmount,
        toSymbol='#',
      } = value;

      fromCountryInput.value = fromCountry;
      fromAmountInput.value = fromAmount;
      fromCurrencySymbol.innerText = fromSymbol;
      toCountryInput.value = toCountry;
      toAmountInput.value = toAmount;
      toCurrencySymbol.innerText = toSymbol;
    }).catch(error => console.log(error));
}

const handleChange = (event) => {
  const { name, value } = event.target;
  let target;
  let validValue = Number(value);
  const fromAmount = Number(fromAmountInput.value);

  function convert() {
    if (fromAmount) convertSrcToDest();
    else convertDestToSrc();
  }

  switch (name) {
    case 'inputFromCountry':
      target = countriesWithCurrencies.find(item => item.currencyId === value);
      fromCurrencySymbol.innerText = target.symbol || '#';
      convert();
      break;
    case 'inputToCountry':
      target = countriesWithCurrencies.find(item => item.currencyId === value);
      toCurrencySymbol.innerText = target.symbol || '#';
      convert();
      break;
    case 'inputToAmount':
      if (validValue < 0) validValue = 0;
      inputToAmount.value = validValue;
      convertDestToSrc();
      break;
    case 'inputFromAmount':
      if (validValue < 0) validValue = 0;
      inputFromAmount.value = validValue;
      convertSrcToDest();
      break;
    case 'reset':
      resetSession();
      return;
  }
  saveSession();
}

const convertSrcToDest = () => {
  const amount = fromAmountInput.value;
  const from = fromCountryInput.value;
  const to = toCountryInput.value;
  callback = result => inputToAmount.value = result;
  convertCurrency(amount, from, to, callback);
}

const convertDestToSrc = () => {
  const amount = toAmountInput.value;
  const from = toCountryInput.value;
  const to = fromCountryInput.value;
  callback = result => inputFromAmount.value = result;
  convertCurrency(amount, from, to, callback);
}

const resetSession = () => {
  fromCountryInput.value = defaultCountry;
  fromAmountInput.value =  defaultAmount;
  fromCurrencySymbol.innerText = '#';
  toCountryInput.value = defaultCountry;
  toAmountInput.value =  defaultAmount;
  toCurrencySymbol.innerText = '#';
  logSuccess('');
  logInfo('Select countries');
  saveSession();
}

const saveSession = () => {
  const fromCountry = fromCountryInput.value;
  const fromAmount = fromAmountInput.value;
  const fromSymbol = fromCurrencySymbol.innerText;
  const toCountry = toCountryInput.value;
  const toAmount = toAmountInput.value
  const toSymbol = toCurrencySymbol.innerText;

  const lastSession = {
    fromCountry,
    fromAmount,
    fromSymbol,
    toCountry,
    toAmount,
    toSymbol,
  };

  localIndexStorage.open()
    .then(idb => localIndexStorage.setItem('last-session', lastSession, idb))
    .then(() => console.log('Session saved', new Date().getTime()))
    .catch(error => console.log('Failed to save session', error.message));
}

const fetchCountries = () => {
  logInfo('Fetching data...');
  const url = `${BASE_URL}${LIST_OF_COUNTRIES}`;

  localIndexStorage.open().then(idb => localIndexStorage.getItem(url, idb))
    .then(result => {
      if (!result) throw new Error('Item not found');
      const { value } = result;
      return parseResponse(value);
    }).catch((error) => {
      console.log('Database error',error.message);
      fetchCountriesFromNetwork(url);
    });
}

const fetchCountriesFromNetwork = (url) => {
  return fetch(url)
  .then(response => response.json())
  .then((json) => {
    if (json) {
      const { results } = json;
      // save result to idb
      localIndexStorage.open()
        .then(idb => localIndexStorage.setItem(url, results, idb))
        .catch(error => console.log('Database error', error.message));
      return parseResponse(results);
    }
    logError('Got empty response');
  })
  .catch(() => logError('Requires internet connection'));
}

const parseResponse = (results) => {
  return getCountries(results)
    .then(countries => populateData(countries));
}

// Retrieve useful information from response data and convert to an array
const getCountries = (results) => {
  return new Promise((resolve) => {
    const values = Object.values(results);
    const countries = values.map(value => ({
      currencyId: value.currencyId,
      countryName: value.name,
      symbol: value.currencySymbol,
    }));
    // make countries avalable to view handlers
    countriesWithCurrencies = countries.sort((a, b) => a.countryName.localeCompare(b.countryName));
    logInfo('Select countries');
    return resolve(countries);
  });
}

// populate the view with retrieved data
function populateData(data) {
  for (let index in data) {
    const { countryName, currencyId } = data[index];
    fromCountryInput.appendChild(createOption(countryName, currencyId));
    toCountryInput.appendChild(createOption(countryName, currencyId));
  }
}

// Creates a new <option>
function createOption(key, value) {
  const option = document.createElement('option');
  option.setAttribute('value', value);
  option.innerText = `${key} (${value})`;
  return option;
}

function convertCurrency(amount, from, to, cb) {
  if (!from || !to || !amount) return;
  logInfo('Converting...');
  from = encodeURIComponent(from);
  to = encodeURIComponent(to);
  const query = `${from}_${to}`;
  const reciprocal = `${to}_${from}`;
  const url = `${BASE_URL}${CONVERT}${query},${reciprocal}&compact=ultra`;
  localIndexStorage.open().then(idb => localIndexStorage.getItem(query, idb))
    .then(localResponse => {
      if (!localResponse) throw new Error('Query not found in db');
      const value = localResponse.value;
      return calculate(value, amount, query, cb);
    })
    .catch(error => {
      console.log('Database error: ', error.message);
      convertCurrencyWithNetwork(url, query, reciprocal, amount, cb)
    });
}

const convertCurrencyWithNetwork = (url, query, reciprocal, amount, cb) => {
  return fetch(url)
  .then(response => response.json())
  .then(json => {
    if (json) {
      const reciprocalValue = json[reciprocal]; // retrieve the reciprocal of the query
      const value = json[query];

      calculate(value, amount, query, cb); // calculate the original query
      // save both original and reciprocal query response
      return localIndexStorage.open()
          .then(idb => localIndexStorage.setItem(query, value, idb))
          .then(() => localIndexStorage.open())
          .then(idb => localIndexStorage.setItem(reciprocal, reciprocalValue, idb))
          .catch(error => console.log('Database error: ', error.message))
    } else {
      const message = `Value not found for ${query}`;
      const err = new Error(message);
      logInfo(message);
      console.error(err);
    }
  })
  .catch(error => {
    logError('Requires internet connection');
    console.error("Got an error: ", error);
  })
}

const calculate = (val, amount, query, cb) => {
  const [ from, to ] = query.split('_');
  if (val) {
    const total = val * amount;
    cb(Math.round(total * 100) / 100);
    const message = `At ${val} ${to} per ${from}`;
    logSuccess(message);
  }
}

const logError = (error) => {
  message.innerText = '';
  successMessage.innerText = '';
  errorMessage.innerText = error;
}

const logSuccess = (text) => {
  message.innerText = '';
  successMessage.innerText = text;
  errorMessage.innerText = '';
}

const logInfo = (text) => {
  message.innerText = text;
  successMessage.innerText = '';
  errorMessage.innerText = '';
}

function openDatabase() {
  // Check for service worker and IndexedDB
  if (!navigator.serviceWorker || !window.LocalIndexedStorage) return Promise.resolve();
  localIndexStorage = window.LocalIndexedStorage;
}

class MainController {
  static registerServiceWorker() {
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
      if (!navigator.serviceWorker.controller) {
        return;
      }

      if (registration.waiting) {
        MainController.updateReady(registration.waiting);
        return;
      }

      if (registration.installing) {
        MainController.trackInstalling(registration.installing);
        return;
      }

      registration.addEventListener('updatefound', () => {
        MainController.trackInstalling(registration.installing);
      });

      let refreshing;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        window.location.reload();
        refreshing = true;
      });
    });
  }

  static trackInstalling(worker) {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        MainController.updateReady(worker);
      }
    });
  }

  static updateReady(worker) {
    MainController.showAlert('New version available');

    refreshButton = document.getElementById('refresh');
    dismissButton = document.getElementById('dismiss');

    refreshButton.addEventListener('click', () => worker.postMessage({ action: 'skipWaiting' }));
    dismissButton.addEventListener('click', () => alert.style.display = 'none');
  }

  // update-only notification alert
  static showAlert(message) {
    alert.style.display = 'flex';
    const alertMessage = document.getElementById('alert-message');
    alertMessage.innerText = message;
  }
}
