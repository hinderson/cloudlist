module.exports = {
	api: {
		url: window.location.protocol + '//' +  window.location.host + '/api/',
		version: 'v1'
	},
	settings: {
		debug: true,
		lang: document.documentElement.lang,
		cdn: process.env.NODE_ENV === 'production' ? 'https://static.cloudlist.io' : window.location.protocol + '//' + window.location.host + '/media',
		soundCloudKey: '879664becb66c01bf10c8cf0fd4fbec3',
		documentTitle: ''
	}
};
