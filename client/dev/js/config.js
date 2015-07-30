module.exports = {
	settings: {
		debug: true,
		lang: document.documentElement.lang,
		cdn: process.env.NODE_ENV === 'production' ? 'https://static.cloudlist.io' : '/uploads/',
		documentTitle: '',
		maxItems: 100
	},
};