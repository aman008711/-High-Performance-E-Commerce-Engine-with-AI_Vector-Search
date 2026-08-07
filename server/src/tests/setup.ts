process.env.MONGO_URI = 'mongodb://localhost:27017/ecommerce_test';
console.log('🧪 [Test Setup] Isolated MONGO_URI to:', process.env.MONGO_URI);

// Mock ioredis globally to prevent network connections and open handles during tests
jest.mock('ioredis', () => {
  class MockRedis {
    on() {}
    get() { return Promise.resolve(null); }
    setex() { return Promise.resolve('OK'); }
    del() { return Promise.resolve(1); }
    scan() { return Promise.resolve(['0', []]); }
    quit() { return Promise.resolve(); }
  }
  return {
    __esModule: true,
    default: MockRedis,
    Cluster: class MockCluster extends MockRedis {}
  };
});
