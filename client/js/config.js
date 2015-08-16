module.exports = {
	settings: {
		debug: true,
		lang: document.documentElement.lang,
		cdn: process.env.NODE_ENV === 'production' ? 'https://static.cloudlist.io' : '/media',
		soundCloudKey: '879664becb66c01bf10c8cf0fd4fbec3',
		documentTitle: ''
	}
};
