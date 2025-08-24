import '@testing-library/jest-dom'

// Mock do localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Mock do Notification API
Object.defineProperty(window, 'Notification', {
  value: {
    permission: 'granted',
    requestPermission: jest.fn().mockResolvedValue('granted'),
  },
  writable: true,
})

// Mock do navigator.geolocation
Object.defineProperty(navigator, 'geolocation', {
  value: {
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  },
  writable: true,
})

// Mock do performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
  },
  writable: true,
})

// Mock do CustomEvent
global.CustomEvent = class CustomEvent extends Event {
  constructor(type, options) {
    super(type, options)
    this.detail = options?.detail
  }
}

// Mock do Worker
global.Worker = class Worker {
  constructor() {
    this.onmessage = null
    this.onerror = null
  }
  
  postMessage() {}
  terminate() {}
}

// Mock do URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')

// Mock do console para evitar poluição nos testes
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}
