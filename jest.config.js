module.exports = {
	testEnvironment: 'jsdom',
	testPathIgnorePatterns: ['/node_modules/', '/.idea/', '/config/'],
	moduleDirectories: ['node_modules', 'static'],
	setupFilesAfterEnv: [],
	testMatch: ['**/__tests__/**/*.test.js'],
};