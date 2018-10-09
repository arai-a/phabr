all:
	rm -f phabr.xpi
	zip -9 phabr.xpi phabr.js options.html options.js manifest.json

i: all
	open -a FirefoxNightly phabr.xpi

ia: all
	open -a FirefoxAurora phabr.xpi
