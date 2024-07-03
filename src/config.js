require.config({

	deps: ["level13-app"],

	waitSeconds: 30,

	baseUrl: 'src',

	paths: {
		brejep: "../lib/brejep",
		ash: "../lib/ash/ash.min",
		jquery: "../lib/jquery",
		lzstring: "../lib/lzstring",
        json: "../lib/requirejs/json",
		utils: "utils",
		game: "game"
	},

	config: {
		'level13-app': {
			'isDebugVersion': false,
			'isCheatsEnabled': true,
			'isDebugOutputEnabled': true,
			'isAutosaveEnabled': true,
			'isAnalyticsEnabled': false,
		}
	},
	
	urlArgs: "v=0.5.2",

});
